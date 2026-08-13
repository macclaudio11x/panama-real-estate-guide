/* =============================================================================
   Import the Do Panama campaign list into the CRM
   =============================================================================
   Two sources, deliberately not merged by hand:

     scripts/do-panama-roster.json  — the WhatsApp tracker sheet. The only place
                                      all 86 names, numbers and emails exist.
                                      Its statuses stop at 2026-08-08.
     OVERRIDES below                — the 2026-08-10 call report. Supersedes the
                                      sheet for the 29 people it names.

   The sheet and the report are not contradictory, they are sequential: the call
   pass happened after the sheet was last touched and nobody went back. Taking
   the sheet at face value would file Dwayne Gleaton — a buyer landing on the
   14th — as an untouched cold lead, and George Walker, who the report says to
   ring this week, as a dead number.

   Run it:
     node scripts/import-do-panama-leads.mjs           # dry run, writes nothing
     node scripts/import-do-panama-leads.mjs --commit  # writes to Supabase

   Idempotent on `reference`: re-running updates the existing row rather than
   creating a second copy of a real person.
   ============================================================================= */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");

/* ── The campaign ─────────────────────────────────────────────────────────── */

const CAMPAIGN = {
  source: "do-panama",
  medium: "whatsapp-outreach",
  name: "do-panama-ad-list-aug-2026",
};

/* Every one of these people gave their details to a Panama City ad, which is
   why they are on the list at all — but the tracker never recorded *when*, and
   neither does the call report. `consented_at` is NOT NULL, so it has to hold
   something. It holds the date the list was worked, and every row says so in
   its notes, because a consent timestamp that is really an import date is the
   kind of thing that reads as fact a year later. */
const CONSENT_UNKNOWN =
  "Consent date not captured by the source list — the timestamp on this record is " +
  "the campaign import date, not a verified opt-in. Original source: Panama City ad campaign.";

const IMPORTED_AT = "2026-08-10T12:00:00Z";

/* ── The 2026-08-10 call report ───────────────────────────────────────────────
   Keyed by roster id. `status` is the CRM pipeline stage, `due` becomes
   next_action_at, `note` is written as the opening timeline entry.

   Headline from the report: 73 called · 11 answered · 10 live opportunities ·
   3 calls booked · 2 arriving in Panama this month · 56 no answer · 5 closed. */

const OVERRIDES = {
  // ── Priority 1 — act Tuesday 11 Aug ──────────────────────────────────────
  41: {
    name: "Dwayne Gleaton",
    status: "viewing",
    due: "2026-08-11",
    lookingFor: "Playa Escondida — arriving Fri 14 Aug",
    note:
      "PRIORITY 1. Lands in Panama Fri 14 Aug and wants to see Playa Escondida. " +
      "Already touring the Pacific coast with another broker — every day of delay " +
      "hands that broker ground. Call/WhatsApp Tue 11 Aug to lock the showing. " +
      "Torre 200 deck is ready ammo.",
  },
  34: {
    name: "Robert Harris",
    status: "qualified",
    due: "2026-08-11",
    lookingFor: "Rentals",
    note:
      "CALL BOOKED — Tue 11 Aug, afternoon, as he asked. Rentals. " +
      "Tokunbo tour 9–1 and Kelly's signing are the same day, so slot him late afternoon.",
  },
  22: {
    name: "Paul Murray",
    status: "qualified",
    due: "2026-08-11",
    note:
      "Answered the call — \"super persona\", evaluating options. Asked to be " +
      "contacted by WhatsApp with videos. Open the WhatsApp thread and send the " +
      "video pack Tue 11 Aug.",
  },
  28: {
    status: "qualified",
    due: "2026-08-11",
    lookingFor: "Residency + renting",
    note:
      "Interested, residency plus renting. The call ask from Saturday is still " +
      "unanswered — soft WhatsApp nudge. David has already sent the YouTube " +
      "channel and card.",
  },

  // ── Booked & date-locked ─────────────────────────────────────────────────
  44: {
    status: "qualified",
    due: "2026-08-12",
    note:
      "CALL BOOKED — Wed 12 Aug, at his own request. Also wants WhatsApp contact.",
  },
  65: {
    name: "Robert Holly",
    status: "viewing",
    due: "2026-08-17",
    budget: "Up to $500k",
    lookingFor: "2–3BR villa or condo, Boquete",
    note:
      "In Panama 17–31 Aug — two weeks on the ground. Wants a 2–3BR villa or condo " +
      "in Boquete, golf and fishing, open to the beach towns and Playa Escondida. " +
      "Budget ≈$500K max. Prepare options before the 17th.",
  },
  4: {
    name: "Marilyn Bynum",
    status: "qualified",
    due: "2026-09-04",
    lookingFor: "Rent 6 months, then buy",
    note:
      "CALL BOOKED — Fri 4 Sep, 1:00 PM Panama (11 AM San Diego). Plans to rent a " +
      "house for six months and then buy. " +
      "Matched to the tracker's \"Mdbynum\" row on the number and the 619 San Diego area code.",
  },
  54: {
    status: "qualified",
    due: "2026-09-05",
    note: "Existing appointment Sat 5 Sep — no outreach needed before then.",
  },

  // ── Waiting on them — chase by date ──────────────────────────────────────
  12: {
    name: "Dan (Five Star Tree Service)",
    status: "qualified",
    due: "2026-08-11",
    lookingFor: "Relocation",
    note:
      "Answered — wants to move to Panama, but the reception was bad and he said " +
      "he would call back. If silent by Tue 11 Aug PM, call again. " +
      "The tracker has him as a wrong number; the call pass proves otherwise.",
  },
  24: {
    status: "qualified",
    due: "2026-08-12",
    note:
      "HOT. Emailed to say he is available this week; a time was proposed for " +
      "Monday. If no reply by Wed 12 Aug, call him on +1 (678) 328-8436. " +
      "The tracker has him as a wrong number — that number is live.",
  },
  78: {
    status: "qualified",
    due: "2026-08-12",
    lookingFor: "Residency",
    note:
      "Replied to the email about residency and was answered Monday. If silent by " +
      "Wed 12 Aug, send the follow-up email, then call Thursday.",
  },
  31: {
    status: "qualified",
    due: "2026-08-12",
    lookingFor: "Buying + residency",
    note:
      "Replied to the email about buying and residency and was answered Monday. If " +
      "silent by Wed 12 Aug, send the follow-up email, then call Thursday.",
  },

  // ── Send-info queue (no call needed) ─────────────────────────────────────
  37: {
    status: "contacted",
    due: "2026-08-12",
    lookingFor: "Airbnb-friendly projects",
    note:
      "Wants the Airbnb-friendly projects pack: Dovle, Tribu, VENTU, Uptown " +
      "Condo-Suites, Centro Obarrio. Send the pack — no call needed.",
  },
  68: {
    status: "contacted",
    due: "2026-08-12",
    lookingFor: "Moving 2027",
    note: "Moving in 2027. Wants videos and everything by email — no call needed.",
  },
  30: {
    status: "contacted",
    due: "2026-09-10",
    lookingFor: "Coming in ~6 months",
    note:
      "Arriving in roughly six months. Wants info and videos, low intent for now — " +
      "nurture list rather than a call.",
  },

  // ── Email-only lane ──────────────────────────────────────────────────────
  77: { status: "contacted", due: "2026-08-13", note: "SMS failed. Resend by email this week, using a different subject line — they already received Saturday's campaign." },
  79: { status: "contacted", due: "2026-08-13", note: "SMS failed. Resend by email this week, using a different subject line — they already received Saturday's campaign." },
  80: { status: "contacted", due: "2026-08-13", note: "SMS failed. Resend by email this week, using a different subject line — they already received Saturday's campaign." },
  81: { status: "contacted", due: "2026-08-13", note: "SMS failed. Resend by email this week, using a different subject line — they already received Saturday's campaign." },
  82: { status: "contacted", due: "2026-08-13", note: "SMS failed. Resend by email this week, using a different subject line — they already received Saturday's campaign." },
  83: { status: "contacted", due: "2026-08-13", note: "SMS failed. Resend by email this week, using a different subject line — they already received Saturday's campaign." },
  63: {
    status: "contacted",
    due: "2026-08-13",
    note: "The number is no longer his. Email only, at danthatcher@hotmail.com.",
  },
  59: {
    status: "new",
    due: "2026-08-13",
    note:
      "Untouched — Malaysian number (+60), never messaged. Email-only candidate.",
  },

  // ── Closed this pass ─────────────────────────────────────────────────────
  35: { status: "lost", lostReason: "No longer interested (said so by email)", note: "Closed on the 10 Aug pass — replied by email that he is no longer interested." },
  13: { status: "lost", lostReason: "Changed his mind", note: "Closed on the 10 Aug pass — changed his mind." },
  16: { status: "lost", lostReason: "Not for the moment", note: "Closed on the 10 Aug pass — not for the moment. Worth a revisit later." },
  32: { status: "lost", lostReason: "Number not in service", note: "Closed on the 10 Aug pass — number not in service." },
  46: { status: "lost", lostReason: "Number not in service", note: "Closed on the 10 Aug pass — number not in service." },
  49: { status: "lost", lostReason: "Number not in service", note: "Closed on the 10 Aug pass — number not in service." },
};

/* ── Sheet status → pipeline stage, for everyone the report does not name ──── */

const FROM_SHEET = {
  "Not Contacted": { status: "new" },
  Contacted: { status: "contacted" },
  Replied: { status: "qualified" },
  "Wrong Number": { status: "lost", lostReason: "No WhatsApp on this number" },
};

/* ── Build ────────────────────────────────────────────────────────────────── */

const roster = JSON.parse(
  fs.readFileSync(path.join(HERE, "do-panama-roster.json"), "utf8"),
).leads;

function build(lead) {
  const ov = OVERRIDES[lead.id];
  const base = FROM_SHEET[lead.sheetStatus] ?? { status: "new" };

  const status = ov?.status ?? base.status;
  const lostReason = ov?.lostReason ?? (status === "lost" ? base.lostReason : null);

  const notes = [
    ov?.note,
    lead.sheetNote,
    ov ? "Source: Do Panama call report, 10 Aug 2026." : `Source: Do Panama WhatsApp tracker (sheet status "${lead.sheetStatus}", last updated 8 Aug 2026); not named in the 10 Aug call report.`,
    CONSENT_UNKNOWN,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    row: {
      // Deterministic, so a second run updates rather than duplicates.
      reference: `DOP-2026-${String(lead.id).padStart(3, "0")}`,
      full_name: ov?.name ?? lead.name,
      email: lead.email || null,
      phone: lead.phone || null,
      intent: "outreach",
      status,
      lost_reason: lostReason,
      next_action_at: ov?.due ? `${ov.due}T09:00:00-05:00` : null,
      budget_band: ov?.budget ?? null,
      timeline: ov?.lookingFor ?? lead.lookingFor ?? null,
      notes,
      consented_at: IMPORTED_AT,
      created_at: IMPORTED_AT,
      utm_source: CAMPAIGN.source,
      utm_medium: CAMPAIGN.medium,
      utm_campaign: CAMPAIGN.name,
    },
    fromReport: Boolean(ov),
  };
}

const built = roster.map(build);

/* ── Report ───────────────────────────────────────────────────────────────── */

const byStatus = {};
for (const b of built) byStatus[b.row.status] = (byStatus[b.row.status] ?? 0) + 1;

console.log(`\nDo Panama import — ${built.length} leads`);
console.log(`  from the 10 Aug call report : ${built.filter((b) => b.fromReport).length}`);
console.log(`  from the tracker sheet only : ${built.filter((b) => !b.fromReport).length}`);
console.log("\nPipeline after import:");
for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s.padEnd(12)} ${n}`);
}

const dated = built.filter((b) => b.row.next_action_at).sort((a, b) => a.row.next_action_at.localeCompare(b.row.next_action_at));
console.log(`\nFollow-ups scheduled: ${dated.length}`);
for (const b of dated.slice(0, 12)) {
  console.log(`  ${b.row.next_action_at.slice(0, 10)}  ${b.row.full_name.padEnd(28)} ${b.row.status}`);
}
if (dated.length > 12) console.log(`  … and ${dated.length - 12} more`);

if (!COMMIT) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit to write to Supabase.\n");
  process.exit(0);
}

/* ── Write ────────────────────────────────────────────────────────────────── */

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

const { data, error } = await sb
  .from("leads")
  .upsert(
    built.map((b) => b.row),
    { onConflict: "reference" },
  )
  .select("id, reference, full_name, status");

if (error) {
  console.error("\nImport failed:", error.message);
  process.exit(1);
}

console.log(`\nWrote ${data.length} leads.`);

/* One opening timeline entry per lead, so the CRM shows where each one came
   from rather than appearing to know things from nowhere. Skipped if the lead
   already has events, which is what makes a re-run safe. */

const ids = data.map((d) => d.id);
const { data: existing } = await sb.from("lead_events").select("lead_id").in("lead_id", ids);
const hasEvents = new Set((existing ?? []).map((e) => e.lead_id));

const byRef = new Map(built.map((b) => [b.row.reference, b]));
const events = data
  .filter((d) => !hasEvents.has(d.id))
  .map((d) => ({
    lead_id: d.id,
    actor_email: null,
    kind: "system",
    body: byRef.get(d.reference).fromReport
      ? "Imported from the Do Panama campaign. State taken from the 10 Aug 2026 call report."
      : "Imported from the Do Panama WhatsApp tracker sheet (last updated 8 Aug 2026).",
  }));

if (events.length) {
  const { error: eventError } = await sb.from("lead_events").insert(events);
  if (eventError) {
    console.error("Leads written, but the timeline entries failed:", eventError.message);
    process.exit(1);
  }
  console.log(`Wrote ${events.length} timeline entries.`);
}

console.log("Done.\n");
