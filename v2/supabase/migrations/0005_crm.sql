-- =============================================================================
-- 0005 — leads become a CRM, not a forwarding hop
-- =============================================================================
-- 0001 shaped `leads` around an external system of record: a row was written,
-- pushed to the DO Panama CRM, and the outcome tracked in crm_synced_at /
-- crm_error. The brokers now work here instead, so those two columns describe
-- a hand-off that no longer happens and are dropped.
--
-- Nothing is lost in the drop. The v2 forms have been posting to /api/lead
-- since the cutover, a route that was never built, so this table has never
-- held a row.
--
-- What a CRM needs beyond a contact record is where the lead *is* and what
-- happened to it. Those are deliberately two different things:
--
--   leads.status   — where it is now. One value, queried by the inbox.
--   lead_events    — what happened, append-only. Never updated, never deleted.
--
-- Keeping history out of the leads row is what makes "we called twice and they
-- went cold" reconstructable three months later. A status column alone
-- overwrites its own past every time someone touches it.
-- =============================================================================

-- ── The external CRM hand-off, removed ───────────────────────────────────────

alter table leads
  drop column crm_synced_at,
  drop column crm_error;

drop index if exists leads_unsynced_idx;

-- ── Pipeline ─────────────────────────────────────────────────────────────────
-- Ordered as a buyer actually moves. 'lost' is terminal but says nothing about
-- why, which is what lost_reason is for — a pipeline that cannot tell you why
-- deals die is a list, not a CRM.

create type lead_status as enum (
  'new',
  'contacted',
  'qualified',
  'viewing',
  'negotiating',
  'won',
  'lost'
);

alter table leads
  add column status         lead_status  not null default 'new',
  add column next_action_at timestamptz,
  add column lost_reason    text,

  -- Rate limiting needs to recognise a repeat submitter without the site
  -- holding anyone's IP address. sha256(ip + LEAD_IP_SALT), computed in the
  -- route handler — the raw address never reaches Postgres.
  add column ip_hash        text;

-- The inbox opens on "new, newest first" and filters by status from there.
create index leads_status_created_idx on leads (status, created_at desc);

-- Supports the per-hour submission count in /api/lead. Partial: rows without
-- a hash predate the column or came from a caller with no forwarded address.
create index leads_ip_hash_idx on leads (ip_hash, created_at desc)
  where ip_hash is not null;

-- Drives the follow-up queue: what is due, soonest first.
create index leads_next_action_idx on leads (next_action_at)
  where next_action_at is not null;

-- ── Activity log ─────────────────────────────────────────────────────────────
-- Append-only by convention and by permission: there is no RLS policy allowing
-- update or delete, and nothing in the app issues one. A status change writes
-- a row here as well as setting leads.status, so the timeline is complete
-- without reading the leads row's history.

create type lead_event_kind as enum (
  'note',
  'status_change',
  'call',
  'email',
  'system'          -- written by the app: lead created, notification sent
);

create table lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,

  -- The admin user's email, or null when the app itself wrote the row.
  -- Not a foreign key: brokers come and go from Supabase Auth, and an event
  -- must outlive the account that created it.
  actor_email text,

  kind        lead_event_kind not null,
  body        text,

  -- Populated on status_change only, so the timeline can render "qualified →
  -- viewing" without diffing adjacent rows.
  from_status lead_status,
  to_status   lead_status,

  created_at  timestamptz not null default now(),

  constraint status_change_records_both_ends
    check (kind <> 'status_change' or to_status is not null)
);

create index lead_events_lead_idx on lead_events (lead_id, created_at desc);

-- ── Row level security ───────────────────────────────────────────────────────
-- Same stance as leads in 0001: enabled with NO policy, which denies every
-- role that goes through PostgREST, including the publishable key that ships
-- in the client bundle. Reads and writes happen through the service role
-- inside route handlers and admin server components.
--
-- v1 exposed a lead listing behind nothing but a query-string token.

alter table lead_events enable row level security;

-- ── updated_at ───────────────────────────────────────────────────────────────
-- lead_events has none on purpose: an append-only log has no update path, so
-- a column tracking updates would only ever mislead.
