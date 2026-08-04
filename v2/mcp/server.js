#!/usr/bin/env node
/**
 * Panama Real Estate Guide — MCP server
 *
 * Publishes and edits panamarealestateguide.com content without a git push.
 *
 * That is only true because of two changes made alongside this server:
 *   · lib/articles.ts reads the article index from Supabase, so a title or dek
 *     is no longer hardcoded in a file that lives in git.
 *   · every content route exports `revalidate = 60`, so a write here reaches
 *     the live site inside a minute instead of waiting on a ~45-minute deploy.
 *
 * Run:  node mcp/server.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  db,
  uploadToR2,
  generateImageBytes,
  slugify,
  wordCount,
  lintArticle,
  publishGate,
  categoryId,
  authorId,
  text,
  json,
  fail,
  MEDIA_BASE,
} from "./lib.js";

/* ── Shared schema fragments ──────────────────────────────────────────────── */

const SOURCE = {
  type: "object",
  required: ["url", "label"],
  properties: {
    url: { type: "string", description: "Absolute URL of the primary source." },
    label: { type: "string", description: "Institution and document, e.g. 'DGI — Impuesto de Inmueble'." },
    checkedOn: { type: "string", description: "ISO date you personally opened it. camelCase, not checked_on." },
  },
};

const FAQ = {
  type: "object",
  required: ["q", "a"],
  properties: { q: { type: "string" }, a: { type: "string" } },
};

const ARTICLE_FIELDS = {
  title: { type: "string" },
  dek: { type: "string", description: "Standfirst. Also the meta description and the listing card copy." },
  body: { type: "string", description: "Markdown. Do NOT include an FAQ heading — the template appends one from `faqs`. Charts go in a ```chart fenced JSON block." },
  faqs: { type: "array", items: FAQ },
  sources: { type: "array", items: SOURCE },
  read_minutes: { type: "integer" },
  updated_on: { type: "string", description: "ISO date. Drives the 'Updated August 2026' line." },
  og_image_path: { type: "string", description: "Relative media path, e.g. /articles/<slug>/cover.png." },
  author: { type: "string", description: "Author slug: editorial-team or david-aguirre." },
  reviewer: { type: "string", description: "Reviewer slug, or empty string to clear." },
  reviewed_on: { type: "string", description: "ISO date. Only set when a named reviewer actually signed off — it drives the 'Reviewed for accuracy' badge." },
};

/* ── Tools ────────────────────────────────────────────────────────────────── */

const TOOLS = [
  {
    name: "content_audit",
    description:
      "Health report across articles, areas and projects: word counts, source counts, FAQ counts, missing cover images, drafts. Start here when asked how the site is doing content-wise.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_articles",
    description:
      "List articles with their editorial vitals. Filter to find work: unsourced pages, thin pages, pages with no cover image, drafts.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["buying", "residency", "money", "living"] },
        status: { type: "string", enum: ["published", "draft", "any"], default: "any" },
        needs_sources: { type: "boolean", description: "Only articles with zero sources." },
        needs_image: { type: "boolean", description: "Only articles with no og_image_path." },
        max_words: { type: "integer", description: "Only articles whose body is under this word count." },
        search: { type: "string", description: "Case-insensitive match on slug or title." },
      },
    },
  },
  {
    name: "get_article",
    description: "Full article row by slug, including body, faqs and sources. Read this before editing anything.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string" } },
    },
  },
  {
    name: "create_article",
    description:
      "Create a new article. Publishing requires at least one source, a dek, and a body of 400+ words unless `force` is set. Goes live within ~60 seconds, no deploy.",
    inputSchema: {
      type: "object",
      required: ["slug", "category", "title"],
      properties: {
        slug: { type: "string", description: "URL slug. The page will be /<category>/<slug>." },
        category: { type: "string", enum: ["buying", "residency", "money", "living"] },
        status: { type: "string", enum: ["draft", "published"], default: "draft" },
        force: { type: "boolean", description: "Publish despite failing the source/length gate. Say why in your reply." },
        ...ARTICLE_FIELDS,
      },
    },
  },
  {
    name: "update_article",
    description:
      "Patch an existing article by slug. Only the fields you pass change. Goes live within ~60 seconds, no deploy and no git push.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string" },
        new_slug: { type: "string", description: "Rename. The old URL will 404 unless you add a redirect." },
        category: { type: "string", enum: ["buying", "residency", "money", "living"], description: "Moving category changes the URL." },
        status: { type: "string", enum: ["draft", "published"] },
        force: { type: "boolean" },
        ...ARTICLE_FIELDS,
      },
    },
  },
  {
    name: "set_article_status",
    description: "Publish or unpublish an article. Publishing runs the source/length gate.",
    inputSchema: {
      type: "object",
      required: ["slug", "status"],
      properties: {
        slug: { type: "string" },
        status: { type: "string", enum: ["published", "draft"] },
        force: { type: "boolean" },
      },
    },
  },
  {
    name: "lint_article",
    description:
      "Check an article against the house rules without writing anything: source shape, duplicate FAQ heading, em-dash punctuation tells, thin body.",
    inputSchema: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
  },
  {
    name: "delete_article",
    description: "Delete an article row permanently. Prefer set_article_status draft. Requires confirm.",
    inputSchema: {
      type: "object",
      required: ["slug", "confirm"],
      properties: { slug: { type: "string" }, confirm: { type: "boolean", description: "Must be true." } },
    },
  },

  {
    name: "list_areas",
    description: "All area pages with their sourcing state. Five areas currently carry zero sources.",
    inputSchema: { type: "object", properties: { needs_sources: { type: "boolean" } } },
  },
  {
    name: "get_area",
    description: "Full area row by slug.",
    inputSchema: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
  },
  {
    name: "update_area",
    description:
      "Patch an area page's editorial fields. `suits` and `drawbacks` must be grounded in this area's own sources — they were fabricated once and had to be stripped.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string" },
        positioning: { type: "string" },
        blurb: { type: "string" },
        cost_of_living_note: { type: "string" },
        getting_around_note: { type: "string" },
        suits: { type: "string" },
        drawbacks: { type: "string" },
        title_status: { type: "string", enum: ["titled", "rop", "mixed", "unknown"] },
        title_note: { type: "string" },
        title_source_url: { type: "string" },
        title_verified_on: { type: "string" },
        faqs: { type: "array", items: FAQ },
        sources: { type: "array", items: SOURCE },
      },
    },
  },

  {
    name: "list_projects",
    description: "All projects with their published flag and content state. 18 of 31 are unwritten drafts.",
    inputSchema: {
      type: "object",
      properties: {
        published: { type: "boolean" },
        area: { type: "string", description: "Area slug." },
      },
    },
  },
  {
    name: "get_project",
    description: "Full project row by slug.",
    inputSchema: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
  },
  {
    name: "update_project",
    description:
      "Patch a project's editorial fields. Publishing enforces the database's own constraint: a hook, a drawback, and 3+ FAQs.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string" },
        published: { type: "boolean" },
        hook: { type: "string" },
        location_note: { type: "string" },
        suits: { type: "string" },
        drawbacks: { type: "string" },
        buying_note: { type: "string" },
        architect: { type: "string" },
        storeys: { type: "integer" },
        total_units: { type: "integer" },
        phases: { type: "integer" },
        title_status: { type: "string", enum: ["titled", "rop", "mixed", "unknown"] },
        title_note: { type: "string" },
        title_source_url: { type: "string" },
        price_source_url: { type: "string" },
        price_checked_on: { type: "string" },
        faqs: { type: "array", items: FAQ },
      },
    },
  },

  {
    name: "generate_image",
    description:
      "Generate an illustrated cover with Gemini, upload it to R2, and optionally attach it to an article. House style is enforced: flat editorial illustration in the site palette, no text in the image, and never a photorealistic depiction of a real place or building.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description:
            "What to depict, as an illustration. Describe the article's IDEA, not a photograph of a building — e.g. 'a property title deed splitting into two diverging paths' for the titled-vs-ROP guide.",
        },
        article_slug: { type: "string", description: "Attach the result to this article as its cover and OG image." },
        path: { type: "string", description: "Override the R2 path. Defaults to /articles/<slug>/cover.<ext>." },
        aspect_ratio: { type: "string", default: "16:9" },
        image_size: { type: "string", enum: ["1K", "2K", "4K"], default: "2K" },
      },
    },
  },
  {
    name: "set_article_image",
    description: "Point an article at an already-uploaded media path.",
    inputSchema: {
      type: "object",
      required: ["slug", "path"],
      properties: { slug: { type: "string" }, path: { type: "string" } },
    },
  },
  {
    name: "upload_media",
    description: "Upload a local file to R2 and return its stored path and public URL.",
    inputSchema: {
      type: "object",
      required: ["file_path", "path"],
      properties: {
        file_path: { type: "string", description: "Absolute path on this machine." },
        path: { type: "string", description: "Destination, e.g. /articles/<slug>/cover.webp." },
      },
    },
  },

  {
    name: "list_authors",
    description: "Available bylines and reviewers.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_categories",
    description: "The four categories. These are the URL prefixes.",
    inputSchema: { type: "object", properties: {} },
  },
];

/* ── Handlers ─────────────────────────────────────────────────────────────── */

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

const n = (v) => (Array.isArray(v) ? v.length : 0);

/** Turn the flat tool args into a database row, resolving slugs to ids. */
async function toRow(a) {
  const row = {};
  for (const k of [
    "title", "dek", "body", "faqs", "sources",
    "read_minutes", "updated_on", "og_image_path", "reviewed_on", "status",
  ]) {
    if (a[k] !== undefined) row[k] = a[k];
  }
  if (a.category !== undefined) row.category_id = await categoryId(a.category);
  if (a.author !== undefined) row.author_id = await authorId(a.author);
  if (a.reviewer !== undefined) row.reviewer_id = a.reviewer ? await authorId(a.reviewer) : null;
  if (a.new_slug !== undefined) row.slug = slugify(a.new_slug);
  return row;
}

/** Run lint + the publish gate, and format what the caller needs to see. */
function reviewWrite(merged, willPublish, force) {
  const { errors, warnings } = lintArticle(merged);
  const blockers = willPublish ? publishGate(merged, force) : [];
  return { errors, warnings, blockers };
}

const handlers = {
  async content_audit() {
    const [{ data: arts }, { data: areas }, { data: projects }] = await Promise.all([
      db().from("articles").select("slug, status, body, sources, faqs, og_image_path, updated_on, category_id"),
      db().from("areas").select("slug, sources, faqs, positioning, suits, title_status"),
      db().from("projects").select("slug, published, hook, drawbacks, faqs, price_source_url"),
    ]);
    const { data: cats } = await db().from("categories").select("id, slug");
    const cmap = Object.fromEntries((cats ?? []).map((c) => [c.id, c.slug]));

    const pub = arts.filter((a) => a.status === "published");
    const lines = [];
    lines.push(`ARTICLES — ${arts.length} rows, ${pub.length} published`);
    lines.push(`  zero sources        : ${pub.filter((a) => n(a.sources) === 0).length}`);
    lines.push(`  zero FAQs           : ${pub.filter((a) => n(a.faqs) === 0).length}`);
    lines.push(`  no cover image      : ${pub.filter((a) => !a.og_image_path).length}`);
    lines.push(`  under 1,200 words   : ${pub.filter((a) => wordCount(a.body) < 1200).length}`);
    lines.push("");
    lines.push("  Unsourced published pages, thinnest first:");
    for (const a of pub.filter((x) => n(x.sources) === 0).sort((x, y) => wordCount(x.body) - wordCount(y.body))) {
      lines.push(`    ${String(wordCount(a.body)).padStart(5)}w  /${cmap[a.category_id]}/${a.slug}`);
    }
    lines.push("");
    lines.push(`AREAS — ${areas.length}`);
    for (const a of areas.filter((x) => n(x.sources) === 0)) {
      lines.push(`    no sources: ${a.slug}${a.positioning ? "" : " (also no positioning)"}`);
    }
    lines.push(`  title_status unknown: ${areas.filter((a) => a.title_status === "unknown" || !a.title_status).length}`);
    lines.push("");
    const drafts = projects.filter((p) => !p.published);
    lines.push(`PROJECTS — ${projects.length}, ${projects.length - drafts.length} published, ${drafts.length} unwritten drafts`);
    lines.push(`  published without a price source: ${projects.filter((p) => p.published && !p.price_source_url).length}`);
    lines.push(`  drafts: ${drafts.map((p) => p.slug).join(", ")}`);
    return text(lines.join("\n"));
  },

  async list_articles(a) {
    const { data: cats } = await db().from("categories").select("id, slug");
    const cmap = Object.fromEntries((cats ?? []).map((c) => [c.id, c.slug]));
    let q = db().from("articles").select("slug, title, status, body, sources, faqs, og_image_path, updated_on, category_id");
    if (a.category) q = q.eq("category_id", await categoryId(a.category));
    if (a.status && a.status !== "any") q = q.eq("status", a.status);
    const { data, error } = await q.order("slug");
    if (error) return fail(error.message);

    let rows = data.map((r) => ({
      slug: r.slug,
      url: `/${cmap[r.category_id]}/${r.slug}`,
      title: r.title,
      status: r.status,
      words: wordCount(r.body),
      sources: n(r.sources),
      faqs: n(r.faqs),
      image: Boolean(r.og_image_path),
      updated_on: r.updated_on,
    }));
    if (a.needs_sources) rows = rows.filter((r) => r.sources === 0);
    if (a.needs_image) rows = rows.filter((r) => !r.image);
    if (a.max_words) rows = rows.filter((r) => r.words < a.max_words);
    if (a.search) {
      const t = a.search.toLowerCase();
      rows = rows.filter((r) => r.slug.includes(t) || r.title.toLowerCase().includes(t));
    }
    return json({ count: rows.length, articles: rows });
  },

  async get_article(a) {
    const { data, error } = await db().from("articles").select("*").eq("slug", a.slug).maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail(`No article with slug "${a.slug}".`);
    return json(data);
  },

  async create_article(a) {
    const slug = slugify(a.slug);
    const { data: existing } = await db().from("articles").select("slug").eq("slug", slug).maybeSingle();
    if (existing) return fail(`"${slug}" already exists. Use update_article.`);

    const row = await toRow(a);
    row.slug = slug;
    row.status = a.status ?? "draft";
    if (!row.author_id) row.author_id = await authorId("editorial-team");
    if (row.status === "published" && !row.updated_on) row.updated_on = new Date().toISOString().slice(0, 10);

    const { errors, warnings, blockers } = reviewWrite(row, row.status === "published", a.force);
    if (errors.length) return fail(`Rejected:\n- ${errors.join("\n- ")}`);
    if (blockers.length) {
      return fail(
        `Cannot publish "${slug}":\n- ${blockers.join("\n- ")}\n\n` +
          "Create it as a draft, or pass force: true and explain why in your reply.",
      );
    }
    if (row.status === "published") row.published_at = new Date().toISOString();

    const { error } = await db().from("articles").insert(row).select("id").single();
    if (error) return fail(error.message);
    return text(
      [
        `Created ${row.status} article "${slug}" at /${a.category}/${slug}.`,
        row.status === "published" ? "Live within ~60 seconds. No deploy needed." : "",
        warnings.length ? `\nWarnings:\n- ${warnings.join("\n- ")}` : "",
      ].filter(Boolean).join("\n"),
    );
  },

  async update_article(a) {
    const { data: current, error: readErr } = await db()
      .from("articles").select("*").eq("slug", a.slug).maybeSingle();
    if (readErr) return fail(readErr.message);
    if (!current) return fail(`No article with slug "${a.slug}".`);

    const patch = await toRow(a);
    if (Object.keys(patch).length === 0) return fail("Nothing to update — pass at least one field.");

    const merged = { ...current, ...patch };
    const goingLive = patch.status === "published" && current.status !== "published";
    const { errors, warnings, blockers } = reviewWrite(merged, goingLive, a.force);
    if (errors.length) return fail(`Rejected:\n- ${errors.join("\n- ")}`);
    if (blockers.length) {
      return fail(`Cannot publish "${a.slug}":\n- ${blockers.join("\n- ")}\n\nPass force: true to override.`);
    }
    if (goingLive) patch.published_at = new Date().toISOString();

    const { error } = await db().from("articles").update(patch).eq("slug", a.slug).select("id").single();
    if (error) return fail(error.message);
    return text(
      [
        `Updated "${a.slug}" — ${Object.keys(patch).join(", ")}.`,
        merged.status === "published" ? "Live within ~60 seconds. No deploy needed." : "Still a draft.",
        warnings.length ? `\nWarnings:\n- ${warnings.join("\n- ")}` : "",
      ].filter(Boolean).join("\n"),
    );
  },

  async set_article_status(a) {
    const { data: current } = await db().from("articles").select("*").eq("slug", a.slug).maybeSingle();
    if (!current) return fail(`No article with slug "${a.slug}".`);
    if (a.status === "published") {
      const blockers = publishGate(current, a.force);
      if (blockers.length) {
        return fail(`Cannot publish "${a.slug}":\n- ${blockers.join("\n- ")}\n\nPass force: true to override.`);
      }
    }
    const patch = { status: a.status };
    if (a.status === "published" && !current.published_at) patch.published_at = new Date().toISOString();
    const { error } = await db().from("articles").update(patch).eq("slug", a.slug);
    if (error) return fail(error.message);
    return text(
      a.status === "published"
        ? `Published "${a.slug}". Live within ~60 seconds.`
        : `Unpublished "${a.slug}". It drops out of listings and the sitemap within ~60 seconds; the URL then 404s.`,
    );
  },

  async lint_article(a) {
    const { data } = await db().from("articles").select("*").eq("slug", a.slug).maybeSingle();
    if (!data) return fail(`No article with slug "${a.slug}".`);
    const { errors, warnings } = lintArticle(data);
    const blockers = publishGate(data, false);
    return text(
      [
        `${a.slug} — ${wordCount(data.body)} words, ${n(data.sources)} sources, ${n(data.faqs)} FAQs, cover image ${data.og_image_path ? "yes" : "no"}`,
        errors.length ? `\nErrors:\n- ${errors.join("\n- ")}` : "\nNo errors.",
        warnings.length ? `\nWarnings:\n- ${warnings.join("\n- ")}` : "",
        blockers.length ? `\nWould block a publish:\n- ${blockers.join("\n- ")}` : "",
      ].filter(Boolean).join("\n"),
    );
  },

  async delete_article(a) {
    if (!a.confirm) return fail("Pass confirm: true. Prefer set_article_status draft — deletion loses the body.");
    const { data } = await db().from("articles").select("slug, status").eq("slug", a.slug).maybeSingle();
    if (!data) return fail(`No article with slug "${a.slug}".`);
    const { error } = await db().from("articles").delete().eq("slug", a.slug);
    if (error) return fail(error.message);
    return text(`Deleted "${a.slug}". Add a redirect in v2/public/_redirects if the URL had traffic.`);
  },

  async list_areas(a) {
    const { data, error } = await db()
      .from("areas").select("slug, name, region, title_status, positioning, suits, drawbacks, faqs, sources").order("slug");
    if (error) return fail(error.message);
    let rows = data.map((r) => ({
      slug: r.slug, name: r.name, region: r.region,
      title_status: r.title_status,
      sources: n(r.sources), faqs: n(r.faqs),
      has_positioning: Boolean(r.positioning),
      has_suits: Boolean(r.suits),
      has_drawbacks: Boolean(r.drawbacks),
    }));
    if (a.needs_sources) rows = rows.filter((r) => r.sources === 0);
    return json({ count: rows.length, areas: rows });
  },

  async get_area(a) {
    const { data } = await db().from("areas").select("*").eq("slug", a.slug).maybeSingle();
    if (!data) return fail(`No area with slug "${a.slug}".`);
    return json(data);
  },

  async update_area(a) {
    const { slug, ...patch } = a;
    if (Object.keys(patch).length === 0) return fail("Nothing to update.");
    const { errors } = lintArticle(patch);
    if (errors.length) return fail(`Rejected:\n- ${errors.join("\n- ")}`);
    const { data, error } = await db().from("areas").update(patch).eq("slug", slug).select("id").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail(`No area with slug "${slug}".`);
    return text(`Updated area "${slug}" — ${Object.keys(patch).join(", ")}. Live within ~60 seconds.`);
  },

  async list_projects(a) {
    let q = db().from("projects").select("slug, name, published, status, hook, drawbacks, faqs, price_source_url, area_id");
    if (a.published !== undefined) q = q.eq("published", a.published);
    const { data, error } = await q.order("slug");
    if (error) return fail(error.message);
    const { data: areas } = await db().from("areas").select("id, slug");
    const amap = Object.fromEntries((areas ?? []).map((x) => [x.id, x.slug]));
    let rows = data.map((r) => ({
      slug: r.slug, name: r.name, area: amap[r.area_id] ?? null,
      published: r.published, status: r.status,
      has_hook: Boolean(r.hook), has_drawbacks: Boolean(r.drawbacks),
      faqs: n(r.faqs), has_price_source: Boolean(r.price_source_url),
    }));
    if (a.area) rows = rows.filter((r) => r.area === a.area);
    return json({ count: rows.length, projects: rows });
  },

  async get_project(a) {
    const { data } = await db().from("projects").select("*").eq("slug", a.slug).maybeSingle();
    if (!data) return fail(`No project with slug "${a.slug}".`);
    return json(data);
  },

  async update_project(a) {
    const { slug, ...patch } = a;
    if (Object.keys(patch).length === 0) return fail("Nothing to update.");
    const { data: current } = await db().from("projects").select("*").eq("slug", slug).maybeSingle();
    if (!current) return fail(`No project with slug "${slug}".`);
    const merged = { ...current, ...patch };
    // Mirrors the published_projects_need_content CHECK, so the failure is a
    // readable sentence instead of a Postgres constraint violation.
    if (merged.published) {
      const missing = [];
      if (!merged.hook) missing.push("hook");
      if (!merged.drawbacks) missing.push("drawbacks");
      if (n(merged.faqs) < 3) missing.push("3+ FAQs");
      if (missing.length) return fail(`Cannot publish "${slug}" — missing ${missing.join(", ")}.`);
    }
    const { error } = await db().from("projects").update(patch).eq("slug", slug);
    if (error) return fail(error.message);
    return text(`Updated project "${slug}" — ${Object.keys(patch).join(", ")}. Live within ~60 seconds.`);
  },

  async generate_image(a) {
    let img;
    try {
      img = await generateImageBytes({
        prompt: a.prompt,
        aspectRatio: a.aspect_ratio ?? "16:9",
        imageSize: a.image_size ?? "2K",
      });
    } catch (err) {
      return fail(err.message);
    }
    const ext = (img.mimeType.split("/")[1] || "png").replace("jpeg", "jpg");
    const path = a.path
      ? a.path
      : a.article_slug
        ? `/articles/${slugify(a.article_slug)}/cover.${ext}`
        : `/articles/_scratch/${Date.now()}.${ext}`;

    let up;
    try {
      up = await uploadToR2(img.bytes, img.mimeType, path);
    } catch (err) {
      return fail(err.message);
    }

    let attached = "";
    if (a.article_slug) {
      const { data, error } = await db()
        .from("articles").update({ og_image_path: up.path }).eq("slug", a.article_slug).select("id").maybeSingle();
      if (error) attached = `\nCould not attach to "${a.article_slug}": ${error.message}`;
      else if (!data) attached = `\nUploaded, but no article with slug "${a.article_slug}" to attach it to.`;
      else attached = `\nAttached to "${a.article_slug}" as its cover and OG image. Live within ~60 seconds.`;
    }
    return text(
      `Generated and uploaded.\n  path: ${up.path}\n  url:  ${up.url}\n` +
        `  size: ${(img.bytes.length / 1024).toFixed(0)} KB webp ` +
        `(from ${(img.rawBytes / 1024 / 1024).toFixed(1)} MB jpeg)${attached}`,
    );
  },

  async set_article_image(a) {
    const { data, error } = await db()
      .from("articles").update({ og_image_path: a.path }).eq("slug", a.slug).select("id").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail(`No article with slug "${a.slug}".`);
    return text(`"${a.slug}" now uses ${a.path} (${MEDIA_BASE}${a.path}). Live within ~60 seconds.`);
  },

  async upload_media(a) {
    let bytes;
    try {
      bytes = await readFile(a.file_path);
    } catch (err) {
      return fail(`Cannot read ${a.file_path}: ${err.message}`);
    }
    const type = MIME[extname(a.path).toLowerCase()];
    if (!type) return fail(`Unsupported extension for ${a.path}. Use ${Object.keys(MIME).join(", ")}.`);
    try {
      const up = await uploadToR2(bytes, type, a.path);
      return text(`Uploaded ${(bytes.length / 1024).toFixed(0)} KB.\n  path: ${up.path}\n  url:  ${up.url}`);
    } catch (err) {
      return fail(err.message);
    }
  },

  async list_authors() {
    const { data } = await db().from("authors").select("slug, name, title, credential, is_reviewer").order("slug");
    return json(data);
  },

  async list_categories() {
    const { data } = await db().from("categories").select("slug, name, blurb, position").order("position");
    return json(data);
  },
};

/* ── Wiring ───────────────────────────────────────────────────────────────── */

const server = new Server(
  { name: "panama-real-estate-guide", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const handler = handlers[req.params.name];
  if (!handler) return fail(`Unknown tool "${req.params.name}".`);
  try {
    return await handler(req.params.arguments ?? {});
  } catch (err) {
    return fail(err?.message ?? String(err));
  }
});

await server.connect(new StdioServerTransport());
