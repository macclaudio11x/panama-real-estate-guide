/**
 * Shared plumbing for the Panama Real Estate Guide MCP server.
 *
 * Talks to Supabase, R2 and Gemini directly rather than through an /api/mcp
 * layer on the site. The point of this server is to keep publishing working
 * when the site is mid-deploy or broken, so it must not depend on the site
 * being up.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const V2 = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Credentials come from v2/.env.local, which is gitignored and already holds
   the Supabase service key, the R2 keys and the Airtable token. Ambient env
   wins so a CI or cron run can override without editing the file. */
(function loadEnvLocal() {
  try {
    for (const line of readFileSync(join(V2, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* rely on the ambient environment */
  }
})();

export const MEDIA_BASE = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
  process.env.R2_PUBLIC_URL ||
  "https://pub-d822021476c14bc290064bc9122a3ba6.r2.dev"
).replace(/\/$/, "");

/* ── Supabase ─────────────────────────────────────────────────────────────── */

let _db;
/** Service-role client. Bypasses RLS, which is the only way to see drafts and
 *  to write anything at all. Never expose this server over a network. */
export function db() {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in v2/.env.local.",
    );
  }
  _db = createClient(url, key, { auth: { persistSession: false } });
  return _db;
}

/* ── R2 ───────────────────────────────────────────────────────────────────── */

/**
 * Upload bytes to the media bucket. `path` is the app-relative path stored in
 * the database ("/articles/<slug>/cover.png"); the R2 key is the same string
 * without its leading slash, which is the layout upload-media-r2.mjs already
 * established for project photos. Keeping them identical is what lets
 * lib/media.ts resolve either one with the same rule.
 */
export async function uploadToR2(bytes, contentType, path) {
  for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
    if (!process.env[k]) throw new Error(`Missing ${k} in v2/.env.local.`);
  }
  const key = path.replace(/^\//, "");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { path: `/${key}`, url: `${MEDIA_BASE}/${key}` };
}

/* ── Gemini image generation ──────────────────────────────────────────────── */

/**
 * The house style, prepended to every prompt.
 *
 * Illustration, never photography. The rule this enforces is recorded in the
 * panama-writer skill: a photorealistic image of a named real property is the
 * same failure as a fabricated testimonial, in a format harder to audit. A
 * reader cannot tell a rendered building from a photographed one, so the site
 * does not publish either.
 */
export const HOUSE_STYLE = [
  "Conceptual editorial spot illustration for a serious property-journalism publication.",

  // The signature move. Without an explicit size contrast the model reverts to
  // a centred object on an empty field, which is the generic look this exists
  // to avoid.
  "COMPOSITION: build the image on a deliberate contrast of scale — one element",
  "enormous and one element very small, so the size difference itself carries the",
  "argument. The subject occupies most of the frame. Empty areas must be doing",
  "work as shape, never left over as filler. One clear focal point, off-centre.",

  // Cutout collage rather than drawn vector: the edges are what stop this
  // reading as clip art.
  "TECHNIQUE: hard-edged paper-cutout collage. Every shape looks scissored from",
  "flat coloured stock and laid down. Crisp silhouettes, no outlines, no strokes,",
  "no gradients, no soft shadows, no glow, no 3D shading, no lens effects.",
  "Flat front-on view. No perspective, no vanishing points, no extruded or boxed",
  "edges, no objects tilted into depth.",
  "Slight matte paper grain is allowed. Nothing photographic or rendered.",

  "SUBJECT MATTER: ordinary recognisable objects — a door, a ladder, a key, a wall,",
  "a passport, a stamp, a fence, a set of stairs. One idea per image, stated plainly",
  "through the objects. No montage of several ideas. A human presence, if any, is a",
  "single small flat silhouette with no facial features and no detail.",

  "PALETTE: strictly four flats — deep Pacific navy #0B4F6C, warm paper #F7F4EE,",
  "gold #E8A33D used sparingly as the single accent on the one thing that matters,",
  "and near-black ink #14181C. No other hues, no tints, no pastels.",

  "ABSOLUTELY NO text, letters, words, numbers, labels, logos, signatures or",
  "watermarks anywhere in the image. No squiggles, wavy lines or marks that imitate",
  "handwriting. Where a document needs body copy, use plain solid blocks.",

  "SUBJECT:",
].join(" ");

const PHOTO_WORDS =
  /\b(photo|photograph|photorealistic|photo-realistic|realistic render|3d render|hyperreal|dslr|bokeh|drone shot)\b/i;

const RETRY_MS = [1500, 3000, 4500];

/* Gemini hands back a 2752px JPEG at 300 DPI, around 1.7 MB. That is a print
   asset, not a web one: 54 covers at that size is ~90 MB in the bucket, and
   next/image has to pull the full original once per generated size. 1600px is
   already twice the widest slot the article layout gives it, and flat vector
   art with hard edges is exactly what WebP compresses well — the same picture
   lands around 60 KB. */
const MAX_WIDTH = 1600;

async function toWebp(raw) {
  const bytes = await sharp(raw)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return { bytes, mimeType: "image/webp" };
}

export async function generateImageBytes({
  prompt,
  model = "gemini-3.1-flash-image-preview",
  aspectRatio = "16:9",
  imageSize = "2K",
}) {
  // Checked before the credential, so the house rule holds whether or not the
  // key is configured.
  if (PHOTO_WORDS.test(prompt)) {
    throw new Error(
      `Prompt asks for photographic realism (${prompt.match(PHOTO_WORDS)[0]}). This site does not ` +
        "publish photoreal images of places or buildings — a rendered building is indistinguishable " +
        "from a photographed one and is unauditable. Describe an illustration instead.",
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "Missing GEMINI_API_KEY in v2/.env.local. Add it there (same key the other sites use), then retry.",
    );
  }

  const full = `${HOUSE_STYLE} ${prompt}`;
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: full }] }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: { aspectRatio, imageSize },
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const data = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData?.data) throw new Error("Gemini returned no image.");
      const raw = Buffer.from(part.inlineData.data, "base64");
      return { ...(await toWebp(raw)), rawBytes: raw.length, prompt: full };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_MS.length) await new Promise((r) => setTimeout(r, RETRY_MS[attempt]));
    }
  }
  throw lastErr;
}

/* ── Editorial validation ─────────────────────────────────────────────────── */

export const slugify = (t) =>
  String(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const wordCount = (s) => (s ? String(s).trim().split(/\s+/).length : 0);

/**
 * The house rules, checked in one place so every write path gets them.
 * Returns { errors, warnings }. Errors block a publish; warnings never do.
 */
export function lintArticle(row) {
  const errors = [];
  const warnings = [];
  const body = row.body ?? "";

  if (Array.isArray(row.sources)) {
    row.sources.forEach((s, i) => {
      if (!s || typeof s !== "object") return errors.push(`sources[${i}] must be an object.`);
      if (!s.url) errors.push(`sources[${i}] has no url.`);
      if (!s.label) errors.push(`sources[${i}] has no label.`);
      if ("checked_on" in s || "checkedon" in s) {
        errors.push(`sources[${i}] uses snake_case — the template reads camelCase \`checkedOn\`.`);
      }
      if (!s.checkedOn) warnings.push(`sources[${i}] has no checkedOn date.`);
      if (s.url && !/^https?:\/\//.test(s.url)) errors.push(`sources[${i}].url is not an absolute URL.`);
    });
  }

  if (Array.isArray(row.faqs)) {
    row.faqs.forEach((f, i) => {
      if (!f?.q || !f?.a) errors.push(`faqs[${i}] needs both q and a.`);
    });
  }

  // The template appends its own "Frequently asked questions" from `faqs`.
  if (/^##\s+(frequently asked|faqs?)\b/im.test(body)) {
    errors.push(
      'Body contains its own FAQ heading. The template renders `faqs` under "Frequently asked ' +
        'questions" already, so this ships two FAQ sections. Remove the heading from the body.',
    );
  }

  // Charles reads em-dash-as-connective-tissue as an AI-writing tell. Table
  // pipes and genuine parentheticals are fine, so this counts rather than bans.
  const emDashes = (body.match(/—/g) || []).length;
  if (emDashes > 3) {
    warnings.push(
      `${emDashes} em-dashes in the body. House voice bans em-dash-as-connective-tissue and ` +
        "trailing-dash punchlines — rewrite them as full stops or commas before publishing.",
    );
  }
  if (/—\s*[^\n]{0,60}\.\s*$/m.test(body)) {
    warnings.push("A paragraph ends on a trailing-dash punchline. Rewrite it.");
  }

  const words = wordCount(body);
  if (body && words < 900) warnings.push(`Body is ${words} words. Thin for a guide.`);

  return { errors, warnings };
}

/** Publishing gate. The site's entire premise is that every figure carries a
 *  source, and 28 published pages currently do not. Nothing new joins them
 *  without an explicit override. */
export function publishGate(row, force) {
  if (force) return [];
  const blockers = [];
  if (!Array.isArray(row.sources) || row.sources.length === 0) {
    blockers.push("no sources — every published guide needs at least one primary source");
  }
  if (!row.body || wordCount(row.body) < 400) blockers.push("body is missing or under 400 words");
  if (!row.dek) blockers.push("no dek — it is the listing card and the meta description");
  return blockers;
}

/* ── Lookups ──────────────────────────────────────────────────────────────── */

export async function categoryId(slug) {
  const { data } = await db().from("categories").select("id, slug").eq("slug", slug).maybeSingle();
  if (!data) {
    const { data: all } = await db().from("categories").select("slug").order("position");
    throw new Error(`Unknown category "${slug}". Valid: ${(all ?? []).map((c) => c.slug).join(", ")}`);
  }
  return data.id;
}

export async function authorId(slugOrId) {
  if (/^[0-9a-f-]{36}$/i.test(slugOrId)) return slugOrId;
  const { data } = await db().from("authors").select("id").eq("slug", slugOrId).maybeSingle();
  if (!data) {
    const { data: all } = await db().from("authors").select("slug");
    throw new Error(`Unknown author "${slugOrId}". Valid: ${(all ?? []).map((a) => a.slug).join(", ")}`);
  }
  return data.id;
}

/* ── MCP result helpers ───────────────────────────────────────────────────── */

export const text = (s) => ({ content: [{ type: "text", text: String(s) }] });
export const json = (o) => text(JSON.stringify(o, null, 2));
export const fail = (s) => ({ content: [{ type: "text", text: `Error: ${s}` }], isError: true });
