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
 * The house style, prepended to every prompt. Modelled on leyconsulta.com,
 * which runs documentary-style photography rather than stock or illustration:
 * one person mid-task in a real room, natural window light, warm muted grade.
 *
 * The line this holds, from the panama-writer skill: the site does not publish
 * a photoreal image of a named property or an identifiable place. That is the
 * same failure as a fabricated testimonial in a format harder to audit — a
 * reader takes a photograph of Bioma or a Boquete hillside as evidence about
 * Bioma or Boquete. A photograph of an anonymous person reading a contract at
 * a kitchen table asserts nothing checkable, so it is fair game. Situations,
 * not properties. `PLACE_WORDS` below enforces it.
 */
export const HOUSE_STYLE = [
  "Documentary editorial photograph for a serious property-journalism publication.",
  "Candid reportage, not stock photography and not an illustration.",

  // TREATMENT ONLY. An earlier version of this also prescribed the setting — "a
  // kitchen table, a home desk, a small office" — and every one of 32 covers
  // came back as a person at a desk with paperwork, whatever the article was
  // about. The house style governs how it is shot. The scene decides what is in
  // it, including where it happens and how many people are there.
  "LOCATION: exactly what the scene specifies and nowhere else. Never relocate the",
  "scene to a desk, a kitchen table or an office unless it asks for one.",
  "Wherever it is set, it is a real working place with the wear, clutter and",
  "signage-free background that belongs to it. Nothing styled for the shot.",

  // A neutral depiction of the topic gives a reader no reason to click, so the
  // frame needs a pull. An earlier version got this by making something wrong —
  // a defect, a doubt, a disagreement — which is the copy's job, not the
  // picture's. The reader is deciding whether to move to Panama; a photograph
  // that makes them feel bad about it works against the entire funnel.
  "PULL: the frame holds one moment that has not landed yet but is clearly going",
  "to land well — arriving somewhere, being shown something worth seeing, deciding,",
  "discovering, getting the answer. Forward-leaning, warm, competent, hopeful.",
  "Curiosity, not doubt. The viewer should want to know how it turns out, not what",
  "went wrong.",

  "NEVER: damage, stains, mould, cracks, leaks, dereliction, mess or disrepair.",
  "No arguing, worry, distress, confusion, disappointment, rejection or bad news.",
  "Nobody is being turned away, and nothing in the frame is broken.",

  "PEOPLE: follow the scene exactly on how many, their age, gender and appearance.",
  "Everyone is mid-action and unaware of the camera — never looking at the lens,",
  "never posed, never smiling at nothing. Expressions belong to what they are doing.",

  "LIGHT: available light only, soft and directional. No flash, no studio lighting,",
  "no rim lights, no colour gels.",

  "CAMERA: 35mm or 50mm at eye level, shallow depth of field, slightly off-centre",
  "framing with room to breathe.",

  "GRADE: warm and muted, gentle contrast, no heavy saturation, no teal-and-orange,",
  "no HDR crunch. The grade describes the LIGHT, not the wardrobe — dress people in",
  "the colours the scene gives and never default to an olive or sage sweater.",

  "ABSOLUTELY NO readable text, words, numbers, labels, logos, brand marks, street",
  "signs or watermarks anywhere in the frame. Paperwork and screens stay out of",
  "focus enough that nothing on them can be read.",

  "SCENE:",
].join(" ");

/* Named developments and identifiable places we actually write about. A
   photograph of one of these is a claim about it; a photograph of a person at a
   table is not. This is the line the illustration-only rule was really drawing. */
const PLACE_WORDS = new RegExp(
  "\\b(" +
    [
      // developments in the projects table
      "pino alto", "bioma", "allure", "towncenter", "silverbay", "margaritaville",
      "buenaventura", "altos del maria", "cavarossa", "empire residences", "mova",
      "playa escondida", "the westin",
      // places with an area or article page
      "boquete", "bocas del toro", "costa del este", "punta pacifica", "casco viejo",
      "coronado", "playa venao", "pedasi", "santa catalina", "san blas", "guna yala",
      "amador", "marbella", "obarrio", "santa maria", "panama city skyline",
      "tocumen", "cinta costera",
    ].join("|") +
  ")\\b",
  "i",
);

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
  const named = prompt.match(PLACE_WORDS);
  if (named) {
    throw new Error(
      `Prompt names a real place or development ("${named[0]}"). The house style is photographic, ` +
        "so this would produce a picture a reader takes as evidence about somewhere we make " +
        "checkable claims about — the fabricated-testimonial failure in a harder-to-audit format. " +
        "Photograph the situation instead: the person, the paperwork, the room. Never the property.",
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
/** Drop the body's own "## Sources" section, keeping anything that follows it.
 *  Its dashes are the prescribed label format, not a voice problem. */
function stripSourcesSection(md) {
  const start = md.search(/^##\s+sources\b/im);
  if (start === -1) return md;
  const rest = md.slice(start);
  const next = rest.search(/^##\s+(?!sources\b)/im);
  return md.slice(0, start) + (next === -1 ? "" : rest.slice(next));
}

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
  //
  // The numbered Sources block is excluded. Its dashes sit in the house
  // "Institution — Document" label format that the update_article schema itself
  // prescribes, so counting them flagged well-formed pages as failing. Two
  // writers hit that false positive independently, and a linter that cries wolf
  // on correct work trains people to ignore it.
  const prose = stripSourcesSection(body);
  const emDashes = (prose.match(/—/g) || []).length;
  if (emDashes > 3) {
    warnings.push(
      `${emDashes} em-dashes in the body prose. House voice bans em-dash-as-connective-tissue and ` +
        "trailing-dash punchlines. Rewrite them as full stops or commas before publishing.",
    );
  }
  if (/—\s*[^\n]{0,60}\.\s*$/m.test(prose)) {
    warnings.push("A paragraph ends on a trailing-dash punchline. Rewrite it.");
  }

  // Search-result budgets, measured on whichever field actually reaches the
  // snippet: `seo_title`/`meta_description` when set, otherwise title/dek. The
  // routes emit the title absolutely, with no site-name suffix, so the whole
  // ~60 characters belongs to the article. Warnings rather than errors: a title
  // two characters over should not block a publish.
  const searchTitle = row.seo_title || row.title || "";
  const titleField = row.seo_title ? "seo_title" : "Title";
  if (searchTitle.length > 60) {
    warnings.push(`${titleField} is ${searchTitle.length} characters. Google truncates around 60.`);
  }
  const searchDesc = row.meta_description || row.dek || "";
  const descField = row.meta_description ? "meta_description" : "Dek";
  if (searchDesc.length > 160) {
    warnings.push(`${descField} is ${searchDesc.length} characters. It is the meta description; aim for 140–160.`);
  } else if (searchDesc && searchDesc.length < 120) {
    warnings.push(`${descField} is ${searchDesc.length} characters. Short for a meta description; aim for 140–160.`);
  }
  // The dek is still the standfirst and the card copy even when it is not the
  // snippet, so an overlong one is a layout problem regardless.
  if (row.meta_description && (row.dek ?? "").length > 200) {
    warnings.push(`Dek is ${row.dek.length} characters. Long for a standfirst and a listing card.`);
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
