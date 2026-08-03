#!/usr/bin/env node
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
}

async function main() {
  await loadEnv();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const table = process.argv[2] || "articles";
  const slug = process.argv[3];
  const { data, error } = await db.from(table).select("*").eq("slug", slug).single();
  if (error) {
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

main();
