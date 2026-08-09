#!/usr/bin/env node
/**
 * One-shot backfill: data/airtable.json photos -> projects.photos.
 *
 * Everything else the catalog needs was already in Supabase and matched the
 * JSON exactly. Photos were the only field with no column, which is why the
 * site still had to read the file at build time. Run this once after migration
 * 0008, then data/airtable.json is no longer on the render path.
 *
 * Idempotent: it writes the same list every time, so a second run is a no-op.
 *
 *   node scripts/seed-project-photos.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../mcp/lib.js";

const V2 = join(dirname(fileURLToPath(import.meta.url)), "..");
const { projects } = JSON.parse(readFileSync(join(V2, "data/airtable.json"), "utf8"));

const { data: rows, error } = await db().from("projects").select("slug, photos");
if (error) {
  console.error(
    error.message.includes("photos")
      ? "projects.photos does not exist yet — run migration 0008 first."
      : error.message,
  );
  process.exit(1);
}

const have = new Set(rows.map((r) => r.slug));
let written = 0, skipped = 0, missing = [];

for (const p of projects) {
  if (!have.has(p.slug)) { missing.push(p.slug); continue; }
  const photos = (p.photos ?? []).map((ph) => ({ src: ph.src, alt: ph.alt ?? null }));
  if (!photos.length) { skipped++; continue; }
  const { error: e } = await db().from("projects").update({ photos }).eq("slug", p.slug);
  if (e) { console.error(p.slug, e.message); process.exit(1); }
  written += photos.length;
}

const total = (await db().from("projects").select("slug, photos")).data
  .reduce((n, r) => n + (r.photos?.length ?? 0), 0);

console.log(`wrote ${written} photos across ${projects.length - skipped - missing.length} projects`);
if (skipped) console.log(`${skipped} project(s) had no photos in the JSON`);
if (missing.length) console.log(`not in the database: ${missing.join(", ")}`);
console.log(`projects.photos now holds ${total} rows total`);
