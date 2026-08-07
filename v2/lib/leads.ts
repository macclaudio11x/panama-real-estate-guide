/* =============================================================================
   Lead intake
   =============================================================================
   Everything between "a form was submitted" and "a row exists", kept out of the
   route handler so the handler reads as a sequence of decisions.

   The forms post natively — no JavaScript, no fetch — so this module works from
   a URLSearchParams body as readily as from JSON, and the field names it reads
   are the ones already in the markup rather than a schema invented here.
   ============================================================================= */

import { createHash, randomInt } from "node:crypto";
import { supabaseAdmin } from "./supabase";

/* ── Field mapping ──────────────────────────────────────────────────────────
   The form controls were named for the person filling them in; the columns
   were named for the broker reading them. This is the whole of the difference:

     budget    → budget_band
     residency → residency_interest
     area      → area_id      (by name, resolved below)
     project   → project_id   (by slug, resolved below)
   ------------------------------------------------------------------------- */

/* ── Intent ─────────────────────────────────────────────────────────────────
   Which form produced the lead, and therefore how much is known about it. See
   0006_lead_intent.sql: all three want a broker to get in touch, but only
   `shortlist` and `project` arrive with anything to prepare from.
   ------------------------------------------------------------------------- */

export const LEAD_INTENTS = ["shortlist", "project", "article"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

/** Unknown values fall back to `shortlist` rather than being rejected. The
 *  field is posted by our own markup, so a value we don't recognise means the
 *  markup drifted — and treating a real buyer as a cold reader costs more than
 *  the reverse. */
function readIntent(value: string | null): LeadIntent {
  return LEAD_INTENTS.includes(value as LeadIntent)
    ? (value as LeadIntent)
    : "shortlist";
}

export type LeadInput = {
  intent: LeadIntent;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  budget_band: string | null;
  timeline: string | null;
  financing: string | null;
  residency_interest: string | null;
  notes: string | null;
  area_name: string | null;
  project_slug: string | null;
  page_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  fbp: string | null;
  referrer: string | null;
  honeypot: string | null;
};

/** Trim, cap, then collapse "" to null — a blank <select> posts an empty string,
 *  and an empty string in a nullable column reads as an answered question.
 *
 *  The cap is truncation rather than rejection. Nothing on any of these forms
 *  has an obvious length limit to a person filling it in, so a long answer is
 *  far more likely to be someone who typed a lot than someone attacking us, and
 *  turning them away over it would be absurd. What it stops is the unbounded
 *  case: without a ceiling a single POST can write a megabyte into the CRM, and
 *  the broker's Telegram alert throws outright past 4096 characters. */
function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

/* One line, one number, one reason. `notes` is the only free-text field on any
   of the forms, so it is the only one that needs room; everything else is a
   name, a URL, or a value we put in a <select> ourselves. */
const SHORT = 200; // names, phone numbers, countries, campaign values
const EMAIL = 254; // the maximum length of an address, per RFC 5321
const NOTES = 2000; // roughly 350 words, more than the box invites
const URLISH = 500; // page_path, referrer — long query strings are real

/** Takes a getter rather than a container, so a FormData and a parsed JSON body
 *  read the same way without either being converted into the other. */
export function readLeadInput(read: (name: string) => unknown): LeadInput {
  const g = (name: string, max = SHORT) => clean(read(name), max);
  return {
    intent: readIntent(g("intent")),
    full_name: g("full_name") ?? "",
    email: g("email", EMAIL),
    phone: g("phone"),
    country: g("country"),
    budget_band: g("budget"),
    timeline: g("timeline"),
    financing: g("financing"),
    residency_interest: g("residency"),
    notes: g("notes", NOTES),
    area_name: g("area"),
    project_slug: g("project"),
    page_path: g("page_path", URLISH),
    utm_source: g("utm_source"),
    utm_medium: g("utm_medium"),
    utm_campaign: g("utm_campaign"),
    utm_content: g("utm_content"),
    utm_term: g("utm_term"),
    gclid: g("gclid"),
    fbclid: g("fbclid"),
    fbp: g("fbp"),
    referrer: g("referrer", URLISH),
    honeypot: g("bot-field"),
  };
}

/* ── Validation ─────────────────────────────────────────────────────────────
   Mirrors the two things the database will refuse anyway — a name, and at
   least one way to reach the person (`lead_needs_a_contact_method` in
   0001_init.sql). Checking here is what turns a 500 into a sentence.
   ------------------------------------------------------------------------- */

export function validateLead(input: LeadInput): string | null {
  if (!input.full_name) return "Please tell us your name.";
  if (!input.email && !input.phone) {
    return "Please leave an email address or a phone number so we can reply.";
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email)) {
    return "That email address doesn't look right.";
  }
  return null;
}

/* ── Spam signals ───────────────────────────────────────────────────────────
   Turnstile is what stops scripted submissions, and since it started rejecting
   tokenless posts it stops them before this runs. This is the second look, for
   whatever arrives holding a token Cloudflare was willing to issue: a real
   browser driven by a person doing something other than enquiring, or an
   automation good enough to solve the challenge. Both are rarer than what the
   gate now turns away, and neither is impossible.

   It does not reject anything. What it does is decide whether we send the
   confirmation email, because that email is the only thing here an abuser can
   aim at somebody else: fill the form with a stranger's address and our domain
   sends them mail we composed. A handful of those is a nuisance; a sustained
   run of them is how a sending domain gets classed as a spam source.

   Links in free text are the signature to look for. Nobody enquiring about a
   condo writes a URL into their own name, and a link in the notes of a form
   that promises a phone call back is doing something other than enquiring.
   ------------------------------------------------------------------------- */

const LINKY = /(https?:\/\/|www\.|\[url|<a\s|\[\/url\])/i;

/** Returns the reasons this looks like spam, empty when it doesn't. Phrased as
 *  fragments because they are read in a sentence, in the lead's own timeline. */
export function spamSignals(input: LeadInput): string[] {
  const signals: string[] = [];
  if (LINKY.test(input.full_name)) signals.push("a link in the name field");
  if (input.notes && LINKY.test(input.notes)) signals.push("a link in the notes");
  // A name is not a paragraph. This catches the pasted-message-into-every-field
  // shape without touching anyone with a genuinely long name.
  if (input.full_name.length > 80) signals.push("an implausibly long name");
  return signals;
}

/* ── Reference ──────────────────────────────────────────────────────────────
   Shown to the person on the thank-you page and quoted back by the broker, so
   it needs to be short enough to read aloud. Six digits from a CSPRNG, with
   the unique constraint on the column as the real guarantee — a collision
   surfaces as a failed insert, retried once below.
   ------------------------------------------------------------------------- */

export function newReference(): string {
  const year = new Date().getUTCFullYear();
  return `PRG-${year}-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}

/* ── IP handling ────────────────────────────────────────────────────────────
   Rate limiting needs to recognise a repeat submitter. Storing the address
   itself would make this table a log of who read the site from where, for no
   gain: a salted hash compares exactly as well and reverses to nothing without
   the salt. Without LEAD_IP_SALT set we store nothing rather than store a
   plain unsalted digest, which is trivially reversible across the IPv4 space.
   ------------------------------------------------------------------------- */

export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-nf-client-connection-ip") ?? headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || null;
}

export function hashIp(ip: string | null): string | null {
  const salt = process.env.LEAD_IP_SALT;
  if (!ip || !salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

const MAX_PER_HOUR = 5;

/** True when this address has already submitted more than it plausibly should.
 *  Fails open: if the count query itself errors we would rather take a
 *  duplicate lead than drop a real buyer. */
export async function isRateLimited(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= MAX_PER_HOUR;
}

/* ── Resolving what they were looking at ────────────────────────────────────
   The project form posts a slug, the contact form posts an area name from a
   <select> built off the same list. Neither is trusted: an unknown value
   resolves to null and the lead still saves. Losing the association is a worse
   outcome than losing the lead, so nothing here can throw.
   ------------------------------------------------------------------------- */

export type LeadContext = {
  project_id: string | null;
  area_id: string | null;
  assigned_broker_id: string | null;
};

export async function resolveContext(input: LeadInput): Promise<LeadContext> {
  const sb = supabaseAdmin();
  const [project, area, broker] = await Promise.all([
    input.project_slug
      ? sb.from("projects").select("id, area_id, broker_id").eq("slug", input.project_slug).maybeSingle()
      : Promise.resolve({ data: null }),
    input.area_name
      ? sb.from("areas").select("id").eq("name", input.area_name).maybeSingle()
      : Promise.resolve({ data: null }),
    // `is_default` exists for exactly this: 0001_init.sql notes every lead
    // currently routes to one broker, and the flag is how we pick.
    sb.from("brokers").select("id").eq("is_default", true).maybeSingle(),
  ]);

  return {
    project_id: project.data?.id ?? null,
    // A project page's form posts both; the project's own area wins over the
    // separately-posted name, since it cannot disagree with the project.
    area_id: project.data?.area_id ?? area.data?.id ?? null,
    // A project with its own listing broker beats the site-wide default.
    assigned_broker_id: project.data?.broker_id ?? broker.data?.id ?? null,
  };
}

/* ── The insert ─────────────────────────────────────────────────────────────
   One retry, and only on a reference collision — every other failure is real
   and should surface rather than be papered over.
   ------------------------------------------------------------------------- */

export type SavedLead = { id: string; reference: string };

export async function saveLead(
  input: LeadInput,
  context: LeadContext,
  ipHash: string | null,
): Promise<SavedLead> {
  const sb = supabaseAdmin();
  const row = {
    intent: input.intent,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    country: input.country,
    budget_band: input.budget_band,
    timeline: input.timeline,
    financing: input.financing,
    residency_interest: input.residency_interest,
    notes: input.notes,
    project_id: context.project_id,
    area_id: context.area_id,
    assigned_broker_id: context.assigned_broker_id,
    page_path: input.page_path,
    utm_source: input.utm_source,
    utm_medium: input.utm_medium,
    utm_campaign: input.utm_campaign,
    utm_content: input.utm_content,
    utm_term: input.utm_term,
    gclid: input.gclid,
    fbclid: input.fbclid,
    referrer: input.referrer,
    // Submitting the form is the consent act. The contact form gates the button
    // behind a required checkbox; the project form carries the notice inline.
    consented_at: new Date().toISOString(),
    ip_hash: ipHash,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await sb
      .from("leads")
      .insert({ ...row, reference: newReference() })
      .select("id, reference")
      .single();
    if (!error && data) return data;
    // 23505 = unique_violation, i.e. the reference collided. Anything else is
    // not going to be fixed by trying again.
    if (error?.code !== "23505") {
      throw new Error(error?.message ?? "Could not save the lead.");
    }
  }
  throw new Error("Could not allocate a lead reference.");
}

/** Opens the activity log for a new lead, so the timeline starts at intake
 *  rather than at whenever a human first touched it. */
export async function logIntake(
  lead: SavedLead,
  input: LeadInput,
  suspicious: string[] = [],
): Promise<void> {
  const where = input.project_slug
    ? `the ${input.project_slug} page`
    : input.page_path ?? "the site";
  const campaign = input.utm_campaign ? ` · campaign ${input.utm_campaign}` : "";
  /* Spelt out rather than logged as the raw enum: this line is read by whoever
     picks the lead up, and it needs to say what was and wasn't asked for. */
  const asked =
    input.intent === "article"
      ? "Asked for a broker from a guide — no budget or timeline collected"
      : "Asked for a broker shortlist";
  /* Written into the timeline rather than a column, so the broker sees why the
     lead looks off in the same place he reads everything else about it — and
     sees it next to the line saying no confirmation email went out. */
  const flagged = suspicious.length
    ? ` Flagged as possible spam (${suspicious.join(", ")}); no confirmation email sent.`
    : "";
  await supabaseAdmin()
    .from("lead_events")
    .insert({
      lead_id: lead.id,
      kind: "system",
      body: `Lead ${lead.reference} submitted from ${where}${campaign}. ${asked}.${flagged}`,
    });
}
