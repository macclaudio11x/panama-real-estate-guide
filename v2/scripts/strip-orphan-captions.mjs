/* Two fixes across all published articles.

   1. Orphan chart captions. Italic lines describing a chart that was specced
      and never built ("*... (Bar chart showing inventory compression by
      coastal market. Bocas leads at -52% ...)*"). They read as a broken image
      to a human and they smuggle unsourced figures into prose. Removed rather
      than illustrated: the numbers inside them have no source, so drawing the
      chart would publish the same unverified data with more authority.

   2. One dek containing the article's own generation brief, which renders as
      the meta description and og:description.

   Pass --write to apply; default is a dry run.                                */

import fs from "node:fs/promises";
import path from "node:path";

import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
for (const l of raw.split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CAPTION =
  /^\*[^*\n]{30,}\((?:Donut|Bar|Line|Heat ?map|Map|Chart|Infographic|Pie|Stacked|Timeline|Scatter|Area|Column|Flow|Diagram)[^)]*\)\*\n?/gim;

const NEW_DEK =
  "Panama City investment stock, beachfront at Coronado and Pedasi, and the Boquete mountain communities, compared on yield, appreciation and entry price. Covers pre-construction versus resale, and the LOI-to-closing sequence.";

const { data: arts, error } = await db
  .from("articles")
  .select("id, slug, dek, body, status")
  .eq("status", "published");
if (error) throw new Error(error.message);

const changes = [];
for (const a of arts) {
  const found = [...(a.body ?? "").matchAll(CAPTION)].map((m) => m[0].trim());
  const newBody = (a.body ?? "").replace(CAPTION, "").replace(/\n{3,}/g, "\n\n");
  const fixDek = a.slug === "panama-real-estate-investment-lifestyle-2026";
  if (!found.length && !fixDek) continue;

  const patch = {};
  if (found.length) patch.body = newBody;
  if (fixDek) patch.dek = NEW_DEK;

  changes.push({ slug: a.slug, captions: found.length, dek: fixDek, sample: found[0]?.slice(0, 95) });
  if (WRITE) {
    const { error: e } = await db.from("articles").update(patch).eq("id", a.id);
    if (e) throw new Error(`${a.slug}: ${e.message}`);
  }
}

console.log(`${arts.length} published articles scanned\n`);
for (const c of changes) {
  console.log(`  ${c.slug.padEnd(46)} captions=${c.captions}${c.dek ? "  +dek" : ""}`);
  if (c.sample) console.log(`      ${c.sample}…`);
}
console.log(`\n${changes.length} articles ${WRITE ? "UPDATED" : "would change (dry run — pass --write)"}`);
