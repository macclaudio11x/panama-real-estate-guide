/* =============================================================================
   leads → contacts + deals + activities
   =============================================================================
   Derives the CRM objects from the raw intake rows. `leads` is not modified and
   not deleted: it stays the untouched record of what actually arrived, which is
   what makes this script safe to re-run and safe to get wrong once.

     node scripts/migrate-leads-to-contacts.mjs           # dry run
     node scripts/migrate-leads-to-contacts.mjs --commit

   Deduplication is the point. 86 outreach contacts and 15 inbound enquiries
   were collected by different people, months apart, and never compared. Two
   rows are the same human if they share a phone or an email — matched on the
   last ten digits, because "+1 (240) 346-7788" and "2403467788" are the same
   number written by two different systems.

   Where two rows merge, both still get their own deal. The person is one
   record; the two times they asked about property are two.
   ============================================================================= */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(HERE, "..", ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ── Identity ─────────────────────────────────────────────────────────────── */

/** Last ten digits for anything NANP-length, so a country code written on one
 *  system and omitted on another still matches. Shorter numbers keep all their
 *  digits rather than being padded into a false match. */
function phoneKey(phone) {
  const digits = String(phone ?? "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function emailKey(email) {
  const e = String(email ?? "").trim().toLowerCase();
  return e || null;
}

/* Union–find: two leads join the same contact if they share either key, and
   sharing propagates. A links to B by phone and B to C by email → one person. */
const parent = new Map();
const find = (k) => {
  while (parent.get(k) !== k) {
    parent.set(k, parent.get(parent.get(k)));
    k = parent.get(k);
  }
  return k;
};
const union = (a, b) => {
  parent.has(a) || parent.set(a, a);
  parent.has(b) || parent.set(b, b);
  const [ra, rb] = [find(a), find(b)];
  if (ra !== rb) parent.set(ra, rb);
};

/* ── Load ─────────────────────────────────────────────────────────────────── */

const { data: leads, error } = await sb
  .from("leads")
  .select("*")
  .order("created_at", { ascending: true });
if (error) {
  console.error("Could not read leads:", error.message);
  process.exit(1);
}

const { data: events } = await sb
  .from("lead_events")
  .select("*")
  .order("created_at", { ascending: true });

/* ── Not everyone in `leads` is a person ─────────────────────────────────────
   Of the 15 rows the website form produced before this migration, none was a
   real enquiry: five crypto-spam posts, four bot submissions with random-string
   names, three deliberate test rows, and two seed rows carrying example.com
   addresses and 555 numbers.

   They stay in `leads`, which is the raw record of what arrived and is worth
   keeping for exactly that reason. They do not become contacts, because a
   contact is a human being a broker might ring.

   Every exclusion below reports the row it caught and why, and `--include-junk`
   overrides the lot. Silence would be the wrong behaviour here: a
   misclassified real buyer must be visible, not absent.

   Excluded by reference rather than by pattern. Every one of the fifteen was
   read individually on 2026-08-10, and a list of fifteen decisions a human
   made beats a clever heuristic that will one day drop a real buyer called
   Xiu Ng or rescue a spammer who learned to type a vowel. A lead arriving
   tomorrow is migrated normally, because it is not on this list. */

const NOT_PEOPLE = {
  "PRG-2026-125018": "crypto spam — telegra.ph Coinbase lure",
  "PRG-2026-251651": "crypto spam — telegra.ph Coinbase lure",
  "PRG-2026-419934": "crypto spam — telegra.ph Coinbase lure",
  "PRG-2026-618199": "crypto spam — telegra.ph Coinbase lure",
  "PRG-2026-905875": "crypto spam — telegra.ph Coinbase lure",
  "PRG-2026-177156": "bot submission — random-string name",
  "PRG-2026-696588": "bot submission — random-string name",
  "PRG-2026-495112": "bot submission — random-string name",
  "PRG-2026-716379": "spam — gibberish body naming the site",
  "PRG-2026-120646": "test row written during verification",
  "PRG-2026-409547": "test row written during verification",
  "PRG-2026-617915": "junk submission — \"Test\" / test@gmail.com",
  "PRG-2026-892065": "your own test — ptytradee@protonmail.com (typo of your address)",
  "PRG-2026-173605": "seed data — sarah@example.com, +1 305 555 0142",
  /* The least certain of the fifteen: a plausible Panamanian name and a real
     project page, but no email, no notes, and a number that runs 6000 1234.
     Reads as seed data. Delete this line to migrate him. */
  "PRG-2026-669614": "looks like seed data — confirm before discarding",
};

/* Kept as a net for anything arriving later that is obviously not a person.
   Deliberately only the unambiguous shapes — a URL or a payout figure in the
   name field. No name-plausibility guessing: it cannot be done without
   eventually rejecting somebody real. */
const JUNK_RULES = [
  [/^https?:|telegra\.ph|bit\.ly/i, "name contains a URL", (l) => l.full_name],
  [/\d{4,}\s*(dollars|usd|usdt|eur)\b/i, "name is a payout lure", (l) => l.full_name],
];

function junkReason(lead) {
  if (NOT_PEOPLE[lead.reference]) return NOT_PEOPLE[lead.reference];
  for (const [pattern, reason, field] of JUNK_RULES) {
    if (pattern.test(String(field(lead) ?? ""))) return reason;
  }
  return null;
}

/* Not a reason to exclude anyone — a real person can have a useless number.
   Surfaced so a broker knows before dialling rather than after. */
function dataWarning(lead) {
  if (/\b555[\s-]?\d{4}/.test(String(lead.phone ?? ""))) return "placeholder-looking phone";
  if (!lead.email && !lead.phone) return "no contact method";
  return null;
}

const INCLUDE_JUNK = process.argv.includes("--include-junk");
const junk = [];
const real = [];
for (const lead of leads) {
  const reason = INCLUDE_JUNK ? null : junkReason(lead);
  (reason ? junk : real).push(reason ? { lead, reason } : lead);
}

if (junk.length) {
  console.log(`\nNot migrated — ${junk.length} rows that are not people:`);
  for (const { lead, reason } of junk) {
    const who = (lead.full_name ?? "").slice(0, 44);
    console.log(`  ${lead.reference}  ${who.padEnd(46)} ${reason}`);
  }
  console.log(`  (they stay in \`leads\`; --include-junk migrates them anyway)`);
}

const warned = real.map((l) => [l, dataWarning(l)]).filter(([, w]) => w);
if (warned.length) {
  console.log(`\nMigrated, but worth knowing — ${warned.length}:`);
  for (const [lead, warning] of warned) {
    console.log(`  ${lead.reference}  ${(lead.full_name ?? "").slice(0, 30).padEnd(32)} ${warning}`);
  }
}

/* ── Group leads into people ──────────────────────────────────────────────── */

for (const lead of real) {
  const self = `lead:${lead.id}`;
  parent.set(self, self);
  const pk = phoneKey(lead.phone);
  const ek = emailKey(lead.email);
  if (pk) union(self, `phone:${pk}`);
  if (ek) union(self, `email:${ek}`);
}

const groups = new Map();
for (const lead of real) {
  const root = find(`lead:${lead.id}`);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(lead);
}

/* ── Shape ────────────────────────────────────────────────────────────────── */

const STAGE = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  viewing: "viewing",
  negotiating: "negotiating",
  won: "won",
  lost: "lost",
};

/** Default odds by stage. The broker can override per deal; this is only the
 *  starting guess so a forecast exists at all. Deliberately conservative —
 *  a pipeline that forecasts high is worse than one that forecasts nothing. */
const PROBABILITY = {
  new: 5,
  contacted: 10,
  qualified: 25,
  viewing: 45,
  negotiating: 70,
  won: 100,
  lost: 0,
};

const ACTIVITY_KIND = {
  note: "note",
  call: "call",
  email: "email",
  status_change: "stage_change",
  system: "system",
};

/** Longest name wins: "Rhonda Simmons Young" over "Rhonda", "Marilyn Bynum"
 *  over "Mdbynum". Ties keep the earliest. */
function bestName(rows) {
  return rows
    .map((r) => r.full_name?.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
}

const firstNonNull = (rows, field) => rows.map((r) => r[field]).find((v) => v != null && v !== "");

function dealName(contactName, lead) {
  const what =
    lead.timeline ||
    lead.budget_band ||
    (lead.intent === "outreach" ? "campaign enquiry" : "website enquiry");
  return `${contactName} — ${what}`;
}

const plan = [];

for (const rows of groups.values()) {
  const name = bestName(rows) ?? "Unknown";
  const outreach = rows.some((r) => r.intent === "outreach");

  const contact = {
    full_name: name,
    first_name: name.split(/\s+/)[0],
    email: firstNonNull(rows, "email") ?? null,
    phone: firstNonNull(rows, "phone") ?? null,
    country: firstNonNull(rows, "country") ?? null,
    consented_at: rows.map((r) => r.consented_at).filter(Boolean).sort()[0] ?? null,
    consent_source: outreach
      ? "Panama City ad campaign — original opt-in date not captured by the source list."
      : "Website enquiry form.",
    owner_broker_id: firstNonNull(rows, "assigned_broker_id") ?? null,
    created_at: rows.map((r) => r.created_at).sort()[0],
  };

  const deals = rows.map((lead) => ({
    lead_id: lead.id,
    reference: lead.reference,
    name: dealName(name, lead),
    stage: STAGE[lead.status] ?? "new",
    probability: PROBABILITY[STAGE[lead.status] ?? "new"],
    project_id: lead.project_id,
    area_id: lead.area_id,
    budget_band: lead.budget_band,
    timeline: lead.timeline,
    financing: lead.financing,
    residency_interest: lead.residency_interest,
    requirement: lead.timeline ?? null,
    source: lead.intent === "outreach" ? "outreach" : "inbound",
    intent: lead.intent,
    page_path: lead.page_path,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    utm_term: lead.utm_term,
    gclid: lead.gclid,
    fbclid: lead.fbclid,
    referrer: lead.referrer,
    owner_broker_id: lead.assigned_broker_id,
    next_action_at: lead.next_action_at,
    lost_reason: lead.lost_reason,
    created_at: lead.created_at,
    _notes: lead.notes,
  }));

  plan.push({ contact, deals });
}

/* ── Report ───────────────────────────────────────────────────────────────── */

const merged = plan.filter((p) => p.deals.length > 1);

console.log(`\nleads → contacts + deals`);
console.log(`  leads read      : ${leads.length}`);
console.log(`  contacts        : ${plan.length}`);
console.log(`  deals           : ${plan.reduce((n, p) => n + p.deals.length, 0)}`);
console.log(`  events to carry : ${events?.length ?? 0}`);
console.log(`  merged people   : ${merged.length}`);

if (merged.length) {
  console.log(`\nSame person, more than one enquiry:`);
  for (const p of merged) {
    console.log(`  ${p.contact.full_name}  (${p.contact.phone ?? p.contact.email})`);
    for (const d of p.deals) console.log(`      ${d.reference}  ${d.stage}  ${d.source}`);
  }
}

if (!COMMIT) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit.\n");
  process.exit(0);
}

/* ── Write ────────────────────────────────────────────────────────────────── */

const { count: already } = await sb.from("contacts").select("id", { count: "exact", head: true });
if (already > 0) {
  console.error(
    `\ncontacts already holds ${already} rows. This script builds the table from ` +
      `empty; re-running it over existing data would duplicate every person.\n` +
      `Clear contacts (deals, activities, tasks and appointments cascade) and re-run.\n`,
  );
  process.exit(1);
}

const eventsByLead = new Map();
for (const e of events ?? []) {
  if (!eventsByLead.has(e.lead_id)) eventsByLead.set(e.lead_id, []);
  eventsByLead.get(e.lead_id).push(e);
}

let contactsWritten = 0;
let dealsWritten = 0;
let activitiesWritten = 0;

for (const { contact, deals } of plan) {
  const { data: c, error: cErr } = await sb.from("contacts").insert(contact).select("id").single();
  if (cErr) {
    console.error(`contact "${contact.full_name}" failed:`, cErr.message);
    process.exit(1);
  }
  contactsWritten++;

  for (const deal of deals) {
    const { _notes, ...row } = deal;
    const { data: d, error: dErr } = await sb
      .from("deals")
      .insert({ ...row, contact_id: c.id })
      .select("id")
      .single();
    if (dErr) {
      console.error(`deal "${deal.name}" failed:`, dErr.message);
      process.exit(1);
    }
    dealsWritten++;

    const activities = [];

    // What the enquirer or the campaign wrote, kept as the opening entry
    // rather than flattened into a column.
    if (_notes) {
      activities.push({
        contact_id: c.id,
        deal_id: d.id,
        kind: "note",
        direction: "inbound",
        body: _notes,
        occurred_at: deal.created_at,
      });
    }

    for (const e of eventsByLead.get(deal.lead_id) ?? []) {
      activities.push({
        contact_id: c.id,
        deal_id: d.id,
        kind: ACTIVITY_KIND[e.kind] ?? "system",
        direction: e.kind === "system" ? "internal" : "outbound",
        actor_email: e.actor_email,
        body: e.body,
        from_stage: e.from_status,
        to_stage: e.to_status,
        occurred_at: e.created_at,
      });
    }

    if (activities.length) {
      const { error: aErr } = await sb.from("activities").insert(activities);
      if (aErr) {
        console.error(`activities for "${deal.name}" failed:`, aErr.message);
        process.exit(1);
      }
      activitiesWritten += activities.length;
    }
  }
}

console.log(
  `\nWrote ${contactsWritten} contacts, ${dealsWritten} deals, ${activitiesWritten} activities.`,
);
console.log("`leads` and `lead_events` are untouched — they remain the raw record.\n");
