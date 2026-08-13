/* =============================================================================
   CRM reads and writes
   =============================================================================
   Everything the admin does to a lead. Service-role only — `leads` and
   `lead_events` have RLS enabled with no policy, so nothing else can reach
   them.

   Two rules this module enforces.

   One: a status never changes without an event recording who changed it and
   from what. Overwriting leads.status alone would leave "we called twice and
   they went cold" unreconstructable a month later, which is the difference
   between a CRM and a list of names.

   Two: every read and every write takes a `viewer`. Because these queries run
   as the service role they are past RLS, so the scoping *is* the access
   control — there is no second net underneath. A broker sees the leads
   assigned to them and nothing else, enforced here rather than in the pages,
   so a Server Action reached by POST without going through the UI is subject
   to the same rule as the screen that renders its form.
   ============================================================================= */

import { supabaseAdmin } from "./supabase";
import type { AdminUser } from "./admin-auth";
import type { LeadIntent } from "./leads";

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
  /** Which form produced it. An `article` lead wants a broker like any other
   *  but was never asked for a budget or timeline, so the queue has to show
   *  that before someone opens the call — see 0006_lead_intent.sql. */
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
  /** Kept alongside the embedded `broker` because authorisation compares ids,
   *  and the embed is null for an unassigned lead either way. */
  assigned_broker_id: string | null;
  project: { slug: string; name: string } | null;
  area: { slug: string; name: string } | null;
  broker: { name: string; firm: string | null } | null;
};

export type BrokerRow = {
  id: string;
  slug: string;
  name: string;
  firm: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "broker";
  is_active: boolean;
  is_default: boolean;
  auth_user_id: string | null;
  open_leads?: number;
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
  id, reference, intent, full_name, email, phone, country,
  budget_band, timeline, financing, residency_interest, notes,
  status, next_action_at, lost_reason,
  page_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  gclid, fbclid, referrer, consented_at, created_at, assigned_broker_id,
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

/** The single point where "who is asking" becomes a WHERE clause. An admin is
 *  unfiltered; a broker is narrowed to their own rows. Every list query goes
 *  through this, so adding a new view cannot accidentally skip the scoping —
 *  the query builder it hands back is already narrowed.
 *
 *  Note the deliberate asymmetry with the unassigned pool: a broker does not
 *  see unassigned leads. Leads reach them by being handed over, which is what
 *  makes "nobody picked this up" a visible admin problem rather than a thing
 *  everyone assumed someone else had done. */
function scoped(viewer: AdminUser) {
  const query = supabaseAdmin().from("leads").select(LEAD_COLUMNS);
  return viewer.role === "admin" ? query : query.eq("assigned_broker_id", viewer.brokerId);
}

/** The same narrowing for the one query that wants a single column. Separate
 *  rather than a `select` parameter because supabase-js derives the row type
 *  from the *literal* select string, and passing it through a variable widens
 *  it to `string` and collapses the result type. */
function scopedStatuses(viewer: AdminUser) {
  const query = supabaseAdmin().from("leads").select("status");
  return viewer.role === "admin" ? query : query.eq("assigned_broker_id", viewer.brokerId);
}

/** Whether this viewer may act on this lead at all. Used by every write, on
 *  the id the client sent, before anything is changed. */
export function canAccessLead(viewer: AdminUser, lead: { assigned_broker_id: string | null }) {
  return viewer.role === "admin" || lead.assigned_broker_id === viewer.brokerId;
}

export type LeadFilter = {
  status?: LeadStatus;
  intent?: LeadIntent;
  /** Admin only, and ignored for a broker, whose whole view is already "mine". */
  unassigned?: boolean;
};

export async function listLeads(
  viewer: AdminUser,
  filter: LeadFilter = {},
): Promise<LeadRow[]> {
  let query = scoped(viewer).order("created_at", { ascending: false }).limit(200);

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.intent) query = query.eq("intent", filter.intent);
  if (filter.unassigned && viewer.role === "admin") query = query.is("assigned_broker_id", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toLead);
}

/** Null for "no such lead" and null for "not yours" are the same answer on
 *  purpose. Distinguishing them would confirm a lead exists to someone who is
 *  not allowed to know that. */
export async function getLead(viewer: AdminUser, id: string): Promise<LeadRow | null> {
  const { data, error } = await scoped(viewer).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLead(data) : null;
}

/** Search across the fields someone actually has to hand when a lead calls
 *  back: a name, the email or number on the caller ID, or the reference from
 *  the confirmation email.
 *
 *  `or()` takes a PostgREST filter string, so the term is escaped before it
 *  goes in — a comma or a parenthesis in the input would otherwise be read as
 *  filter syntax and change which rows come back. */
export async function searchLeads(viewer: AdminUser, term: string): Promise<LeadRow[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const safe = q.replace(/[,()\\*"]/g, " ").trim();
  if (!safe) return [];
  const like = `*${safe}*`;

  const { data, error } = await scoped(viewer)
    .or(
      [
        `full_name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `reference.ilike.${like}`,
        `country.ilike.${like}`,
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map(toLead);
}

/** Callers must have established access to the lead first — `getLead` returning
 *  non-null is that proof. The timeline has no assigned_broker_id of its own to
 *  filter on, so it cannot re-derive the answer. */
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
export async function statusCounts(viewer: AdminUser): Promise<Record<LeadStatus, number>> {
  const { data, error } = await scopedStatuses(viewer);
  if (error) throw new Error(error.message);

  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
    LeadStatus,
    number
  >;
  for (const row of data ?? []) counts[(row as { status: LeadStatus }).status]++;
  return counts;
}

/* ── The follow-up queue ────────────────────────────────────────────────────
   Two different kinds of neglect, which is why this returns two lists rather
   than one sorted one.

   `due` is work someone scheduled and has not done: next_action_at has passed
   or is today. `stale` is work nobody ever scheduled — a lead sitting at 'new'
   with no follow-up date, which is how 14 of the first 15 leads spent their
   first week. A queue that only showed the first would have been empty that
   whole time, which is precisely the failure being fixed. */

export const STALE_AFTER_HOURS = 48;

export type FollowUps = {
  overdue: LeadRow[];
  today: LeadRow[];
  upcoming: LeadRow[];
  stale: LeadRow[];
};

export async function followUps(viewer: AdminUser): Promise<FollowUps> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const staleBefore = new Date(now.getTime() - STALE_AFTER_HOURS * 3600_000);

  const open = LEAD_STATUSES.filter((s) => s !== "won" && s !== "lost");

  const [dated, neglected] = await Promise.all([
    scoped(viewer)
      .not("next_action_at", "is", null)
      .in("status", open)
      .order("next_action_at", { ascending: true })
      .limit(200),
    // No follow-up booked and never worked. Ordered oldest first: the lead that
    // has been waiting longest is the one costing the most.
    scoped(viewer)
      .is("next_action_at", null)
      .eq("status", "new")
      .lt("created_at", staleBefore.toISOString())
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  if (dated.error) throw new Error(dated.error.message);
  if (neglected.error) throw new Error(neglected.error.message);

  const rows = (dated.data ?? []).map(toLead);

  return {
    overdue: rows.filter((l) => l.next_action_at! < now.toISOString()),
    today: rows.filter(
      (l) => l.next_action_at! >= now.toISOString() && l.next_action_at! <= endOfToday.toISOString(),
    ),
    upcoming: rows.filter((l) => l.next_action_at! > endOfToday.toISOString()),
    stale: (neglected.data ?? []).map(toLead),
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** Thrown when a viewer acts on a lead that is not theirs. Reaching this means
 *  the request did not come through the UI, so it is a hard failure rather than
 *  a redirect — nothing legitimate produces it. */
export class Forbidden extends Error {
  constructor() {
    super("Not your lead.");
    this.name = "Forbidden";
  }
}

/** Re-reads ownership from the database on the id the client supplied. The
 *  client says *which* lead; it never says whose it is. */
async function assertAccess(viewer: AdminUser, leadId: string): Promise<LeadRow> {
  const lead = await getLead(viewer, leadId);
  if (!lead) throw new Forbidden();
  return lead;
}

export async function addNote(
  viewer: AdminUser,
  leadId: string,
  kind: "note" | "call" | "email",
  body: string,
): Promise<void> {
  await assertAccess(viewer, leadId);

  const { error } = await supabaseAdmin()
    .from("lead_events")
    .insert({ lead_id: leadId, actor_email: viewer.email, kind, body });
  if (error) throw new Error(error.message);
}

/** Hand a lead to a broker, or take it back with null.
 *
 *  Admin only. A broker who could reassign could take any lead by first giving
 *  it to themselves, which would make the scoping in `scoped()` decorative.
 *
 *  Logged as `system` rather than a dedicated event kind: adding a value to
 *  lead_event_kind means an ALTER TYPE, and every schema change here is a
 *  hand-off to be pasted into the Supabase SQL editor. Not worth a migration
 *  for a label. */
export async function assignLead(
  viewer: AdminUser,
  leadId: string,
  brokerId: string | null,
): Promise<void> {
  if (viewer.role !== "admin") throw new Forbidden();

  const sb = supabaseAdmin();
  const lead = await assertAccess(viewer, leadId);
  if (lead.assigned_broker_id === brokerId) return;

  let toName = "nobody";
  if (brokerId) {
    const { data, error } = await sb
      .from("brokers")
      .select("name, is_active")
      .eq("id", brokerId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const broker = data as { name: string; is_active: boolean } | null;
    // Assigning to a deactivated broker parks the lead somewhere nobody is
    // looking — it would vanish from the admin's scoped views and never appear
    // in anyone else's.
    if (!broker || !broker.is_active) throw new Error("That broker cannot take leads.");
    toName = broker.name;
  }

  const { error } = await sb
    .from("leads")
    .update({ assigned_broker_id: brokerId })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  const { error: eventError } = await sb.from("lead_events").insert({
    lead_id: leadId,
    actor_email: viewer.email,
    kind: "system",
    body: `Assigned to ${toName}.`,
  });
  if (eventError) throw new Error(eventError.message);
}

/* ── Brokers ────────────────────────────────────────────────────────────── */

/** The roster, with each broker's open workload. Two queries rather than a
 *  join because PostgREST cannot aggregate a filtered embed, and the roster is
 *  a handful of rows. */
export async function listBrokers(): Promise<BrokerRow[]> {
  const sb = supabaseAdmin();

  const [{ data, error }, { data: leadRows, error: leadError }] = await Promise.all([
    sb
      .from("brokers")
      .select("id, slug, name, firm, email, phone, role, is_active, is_default, auth_user_id")
      .order("is_active", { ascending: false })
      .order("name"),
    sb
      .from("leads")
      .select("assigned_broker_id")
      .not("assigned_broker_id", "is", null)
      .not("status", "in", "(won,lost)"),
  ]);

  if (error) throw new Error(error.message);
  if (leadError) throw new Error(leadError.message);

  const open = new Map<string, number>();
  for (const row of leadRows ?? []) {
    const id = (row as { assigned_broker_id: string }).assigned_broker_id;
    open.set(id, (open.get(id) ?? 0) + 1);
  }

  return (data ?? []).map((b) => ({
    ...(b as unknown as BrokerRow),
    open_leads: open.get((b as { id: string }).id) ?? 0,
  }));
}

/** Just the brokers a lead can actually be handed to. */
export async function assignableBrokers(): Promise<BrokerRow[]> {
  return (await listBrokers()).filter((b) => b.is_active);
}

/** Sets the status and records the transition. The read of the current status
 *  and the write are not in a transaction: two people moving the same lead in
 *  the same second could log a from_status that is already stale.
 *
 *  Now that leads are scoped to one broker each, the two people racing would
 *  have to be that broker and an admin, on the same lead, in the same second.
 *  Still not worth a transaction: the events stay append-only, so both moves
 *  are recorded and the final status is whichever landed last. Only the arrow
 *  on one row would read oddly, and the row after it corrects the picture. */
export async function setStatus(
  viewer: AdminUser,
  leadId: string,
  to: LeadStatus,
  opts: { lostReason?: string | null; nextActionAt?: string | null } = {},
): Promise<void> {
  const sb = supabaseAdmin();

  // Doubles as the authorisation check and the read of the current status, so
  // the board's drag handler cannot move a lead belonging to someone else.
  const from = (await assertAccess(viewer, leadId)).status;

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
    actor_email: viewer.email,
    kind: "status_change",
    from_status: from,
    to_status: to,
    body: to === "lost" && opts.lostReason ? opts.lostReason : null,
  });
  if (eventError) throw new Error(eventError.message);
}
