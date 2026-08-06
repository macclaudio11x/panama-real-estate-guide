#!/usr/bin/env node
/* =============================================================================
   Preview the buyer confirmation email
   =============================================================================
   Renders the real template from lib/lead-notify.ts — not a copy of it — so
   what you read here is exactly what sends. Nothing is delivered and no API
   key is needed.

   Usage:
     node scripts/preview-welcome-email.mjs               # writes preview.html
     node scripts/preview-welcome-email.mjs --text        # plain-text version
     node scripts/preview-welcome-email.mjs --name "Ana"
     node scripts/preview-welcome-email.mjs --brief       # the article-capture reply
     node scripts/preview-welcome-email.mjs --brief --category money

   Requires Node 22+ for native TypeScript type-stripping; the import below is
   a .ts file. lib/lead-notify.ts imports only types from ./leads, so nothing
   else has to resolve.
   ============================================================================= */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { renderClientWelcome } = await import(path.join(ROOT, "lib", "lead-notify.ts"));

const args = process.argv.slice(2);
const nameFlag = args.indexOf("--name");
const full_name = nameFlag !== -1 ? args[nameFlag + 1] : "Sarah Whitfield";

/* Two emails send now, so both have to be previewable or the claim above stops
   being true. --brief renders the reply to an article capture; --category picks
   which set of guides it promises, since that is the part most likely to rot. */
const brief = args.includes("--brief");
const categoryFlag = args.indexOf("--category");
const category = categoryFlag !== -1 ? args[categoryFlag + 1] : "buying";

const { subject, text, html } = renderClientWelcome(
  { id: "00000000-0000-0000-0000-000000000000", reference: "PRG-2026-104829" },
  {
    full_name,
    intent: brief ? "brief" : "shortlist",
    page_path: `/${category}/some-guide`,
  },
);

console.log(`Subject: ${subject}\n`);

if (args.includes("--text")) {
  console.log(text);
} else {
  const out = path.join(ROOT, "preview-welcome-email.html");
  writeFileSync(out, html);
  console.log(`Wrote ${out}`);
}
