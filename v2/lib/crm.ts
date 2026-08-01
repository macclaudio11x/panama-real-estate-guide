/* =============================================================================
   CRM reads and writes
   =============================================================================
   Everything the admin does to a lead. Service-role only — `leads` and
   `lead_events` have RLS enabled with no policy, so nothing else can reach
   them.

   The one rule this module enforces: a status never changes without an event
   recording who changed it and from what. Overwriting leads.status alone would
   leave "we called twice and they went cold" unreconstructable a month later,
   which is the difference between a CRM and a list of names.
   ============================================================================= */

import { supabaseAdmin } from "./supabase";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "negotiating",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  viewing: "Viewing",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export type LeadRow = {
  id: string;
  reference: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  budget_band: string | null;
  timeline: string | null;
  financing: string | null;
  residency_interest: string | null;
  notes: string | null;
  status: LeadStatus;
  next_action_at: string | null;
  lost_reason: string | null;
  page_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  referrer: string | null;
  consented_at: string;
  created_at: string;
  project: { slug: string; name: string } | null;
  area: { slug: string; name: string } | null;
  broker: { name: string; firm: string | null } | null;
};

export type LeadEvent = {
  id: string;
  kind: "note" | "status_change" | "call" | "email" | "system";
  actor_email: string | null;
  body: string | null;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  created_at: string;
};

const LEAD_COLUMNS = `
  id, reference, full_name, email, phone, country,
  budget_band, timeline, financing, residency_interest, notes,
  status, next_action_at, lost_reason,
  page_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  gclid, fbclid, referrer, consented_at, created_at,
  project:projects ( slug, name ),
  area:areas ( slug, name ),
  broker:brokers ( name, firm )
`;

/** PostgREST returns an embedded one-to-one as an object, but the generated
 *  types widen it to an array. Collapse it once here rather than at each use. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toLead(row: Record<string, unknown>): LeadRow {
  return {
    ...(row as unknown as LeadRow),
    project: one(row.project as never),
    area: one(row.area as never),
    broker: one(row.broker as never),
  };
}

export async function listLeads(status?: LeadStatus): Promise<LeadRow[]> {
  let query = supabaseAdmin()
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toLead);
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLead(data) : null;
}

export async function getLeadEvents(leadId: string): Promise<LeadEvent[]> {
  const { data, error } = await supabaseAdmin()
    .from("lead_events")
    .select("id, kind, actor_email, body, from_status, to_status, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadEvent[];
}

/** Counts per status for the overview, in one round trip rather than seven. */
export async function statusCounts(): Promise<Record<LeadStatus, number>> {
  const { data, error } = await supabaseAdmin().from("leads").select("status");
  if (error) throw new Error(error.message);

  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
    LeadStatus,
    number
  >;
  for (const row of data ?? []) counts[(row as { status: LeadStatus }).status]++;
  return counts;
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export async function addNote(
  leadId: string,
  actorEmail: string,
  kind: "note" | "call" | "email",
  body: string,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("lead_events")
    .insert({ lead_id: leadId, actor_email: actorEmail, kind, body });
  if (error) throw new Error(error.message);
}

/** Sets the status and records the transition. The read of the current status
 *  and the write are not in a transaction: two people moving the same lead in
 *  the same second could log a from_status that is already stale. With one
 *  broker that is not a real scenario, and the events remain append-only, so
 *  nothing is lost either way — only the arrow in one row would read oddly. */
export async function setStatus(
  leadId: string,
  actorEmail: string,
  to: LeadStatus,
  opts: { lostReason?: string | null; nextActionAt?: string | null } = {},
): Promise<void> {
  const sb = supabaseAdmin();

  const { data: current, error: readError } = await sb
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .single();
  if (readError) throw new Error(readError.message);

  const from = (current as { status: LeadStatus }).status;

  const { error: writeError } = await sb
    .from("leads")
    .update({
      status: to,
      // Clearing the reason when a lead comes back from 'lost' keeps the field
      // honest: a live lead carrying "went with another broker" reads as fact.
      lost_reason: to === "lost" ? (opts.lostReason ?? null) : null,
      ...(opts.nextActionAt !== undefined ? { next_action_at: opts.nextActionAt } : {}),
    })
    .eq("id", leadId);
  if (writeError) throw new Error(writeError.message);

  if (from === to) return;

  const { error: eventError } = await sb.from("lead_events").insert({
    lead_id: leadId,
    actor_email: actorEmail,
    kind: "status_change",
    from_status: from,
    to_status: to,
    body: to === "lost" && opts.lostReason ? opts.lostReason : null,
  });
  if (eventError) throw new Error(eventError.message);
}
