#!/usr/bin/env node
/* =============================================================================
   Seed authors + categories
   =============================================================================
   Idempotent, upserts on slug. Run once to replace the hardcoded stubs that
   used to live in lib/content.ts (an "editorial-team" byline and a
   "legal-reviewer" placeholder with no real credential) with real rows.

   Usage:
     node scripts/seed-authors-categories.mjs

   Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — this bypasses RLS to
   write, same as import-to-supabase.mjs.
   ============================================================================= */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8").catch(() => "");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
}

async function main() {
  await loadEnv();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { data: authorRows, error: authorErr } = await db
    .from("authors")
    .upsert(
      [
        {
          slug: "editorial-team",
          name: "Editorial Team",
          title: "Panama Real Estate Guide",
          bio: "We research and write every guide on this site, and we do not accept payment for coverage.",
          is_reviewer: false,
          credential: null,
        },
        {
          slug: "david-aguirre",
          name: "David Aguirre",
          title: "Real estate agent",
          bio: "Reviews guides that touch pricing, title, and the mechanics of buying before they publish.",
          is_reviewer: true,
          credential: "Panama-licensed real estate agent, licence no. PN-2753",
          licence_no: "PN-2753",
          avatar_url: "/authors/david-aguirre.webp",
        },
      ],
      { onConflict: "slug" },
    )
    .select("id, slug, name");
  if (authorErr) throw new Error(`authors: ${authorErr.message}`);
  console.log("authors:", authorRows);

  const { data: catRows, error: catErr } = await db
    .from("categories")
    .upsert(
      [
        { slug: "buying", name: "Buying", blurb: "Process, contracts, due diligence", position: 0 },
        { slug: "residency", name: "Residency", blurb: "Visas, permits, citizenship", position: 1 },
        { slug: "money", name: "Money", blurb: "Banking, taxes, financing", position: 2 },
        { slug: "living", name: "Living", blurb: "Cost of living, healthcare, schools", position: 3 },
      ],
      { onConflict: "slug" },
    )
    .select("id, slug, name");
  if (catErr) throw new Error(`categories: ${catErr.message}`);
  console.log("categories:", catRows);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
