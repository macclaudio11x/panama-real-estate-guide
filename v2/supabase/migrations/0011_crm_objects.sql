/* =============================================================================
   0011_crm_objects.sql — a person, and the deals they have
   =============================================================================
   Everything so far has been built on `leads`, where one row is the person AND
   the enquiry AND the pipeline position. That holds exactly until one of three
   ordinary things happens:

     · the same person enquires twice (already true — the 86 imported outreach
       contacts and the 15 inbound enquiries were never checked against each
       other, and share a market);
     · someone buys, then buys again, or refers a friend;
     · someone is working two purchases at once — a rental now, a purchase in
       six months, which is literally Marilyn Bynum's stated plan.

   In all three the flat row forces a choice between losing the history and
   duplicating the human being. So it splits:

     contacts   — the person. One row per human, forever.
     deals      — a thing they might buy. Many per contact, over years.
     activities — what happened. Hangs off the contact, optionally off a deal.
     tasks      — a discrete to-do someone owns.
     appointments — a call or a showing, at a time.
     deal_projects — which developments a buyer was shown, and what they said.

   `leads` is not dropped. It stays as the raw intake record — the untouched
   thing the website form wrote, spam signals and all — and the CRM objects are
   derived from it. Keeping the raw capture means a bad migration is a rerun
   rather than a loss.

   ⚠️ Apply before deploying the code that accompanies it, and run
   scripts/migrate-leads-to-contacts.mjs afterwards to populate these tables.
   ============================================================================= */

/* ── Contacts ────────────────────────────────────────────────────────────────
   The normalised columns exist because deduplication is the whole reason this
   table is worth having, and it cannot be done on raw input: the same person
   is "+1 (240) 346-7788" in the tracker and "+1 240 346 7788" on a form.

   Generated rather than written by the app so they cannot drift, and indexed
   rather than unique because two people genuinely do share a phone — couples
   buying together are a large fraction of this market. Duplicate detection is
   a prompt to a human, not a constraint that rejects a real buyer. */

create table contacts (
  id             uuid primary key default gen_random_uuid(),

  full_name      text not null,
  first_name     text,
  email          text,
  phone          text,
  whatsapp       text,
  country        text,

  email_norm     text generated always as (lower(nullif(trim(email), ''))) stored,
  phone_norm     text generated always as (
                   nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
                 ) stored,

  /* Honoured across every channel and every sequence. A single flag, because
     "unsubscribed from email but still WhatsApped" is how a business ends up
     reported. */
  do_not_contact boolean not null default false,
  dnc_reason     text,

  /* Where the right to contact them came from, in words. Free text on purpose:
     "contact form 2026-08-07" and "Panama City ad campaign, opt-in date not
     captured" are both honest, and only one of them is a timestamp. */
  consent_source text,
  consented_at   timestamptz,

  owner_broker_id uuid references brokers(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint contact_needs_a_contact_method
    check (email is not null or phone is not null)
);

create index contacts_email_idx on contacts (email_norm) where email_norm is not null;
create index contacts_phone_idx on contacts (phone_norm) where phone_norm is not null;
create index contacts_owner_idx on contacts (owner_broker_id) where owner_broker_id is not null;
create index contacts_name_idx  on contacts (lower(full_name));

/* ── Deals ───────────────────────────────────────────────────────────────────
   The same seven stages the board already uses. A separate type from
   lead_status because `leads` keeps its own column for the archived intake
   record, and one type serving two meanings is how enums rot. */

create type deal_stage as enum (
  'new', 'contacted', 'qualified', 'viewing', 'negotiating', 'won', 'lost'
);

create table deals (
  id             uuid primary key default gen_random_uuid(),
  contact_id     uuid not null references contacts(id) on delete cascade,

  /* Human-readable, because a pipeline of "Deal #4471" is unreadable.
     Generated on import as e.g. "Robert Holly — Boquete villa". */
  name           text not null,
  stage          deal_stage not null default 'new',

  /* ── Money ───────────────────────────────────────────────────────────────
     Absent until now, which is why the board could not rank anything. All
     nullable: an unqualified lead has no number, and a zero would be a lie
     that averages into forecasts. */
  value_usd       numeric(12,2),
  commission_pct  numeric(5,2),
  expected_close_on date,
  /* 0–100. Defaulted from the stage by the app, overridable per deal, because
     the broker on the call knows things the stage does not. */
  probability     smallint,

  /* ── What they want ─────────────────────────────────────────────────────── */
  project_id     uuid references projects(id) on delete set null,
  area_id        uuid references areas(id) on delete set null,
  budget_band    text,
  timeline       text,
  financing      text,
  residency_interest text,
  /* The sentence a broker would actually say: "2–3BR Boquete, golf + fishing,
     open to beach towns, $500K max". */
  requirement    text,

  /* ── Where it came from ─────────────────────────────────────────────────── */
  source         text not null default 'inbound',
  intent         text,
  page_path      text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  gclid          text,
  fbclid         text,
  referrer       text,

  /* ── Working state ──────────────────────────────────────────────────────── */
  owner_broker_id uuid references brokers(id) on delete set null,
  next_action_at timestamptz,
  lost_reason    text,

  /* Carried from the intake record (PRG-…) or the campaign import (DOP-…), so
     a reference quoted in an email still finds the deal. */
  reference      text unique,
  /* The raw row this was derived from, kept so the migration is auditable. */
  lead_id        uuid references leads(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint deal_probability_is_a_percentage
    check (probability is null or (probability >= 0 and probability <= 100)),
  constraint deal_source_known
    check (source in ('inbound', 'outreach', 'referral', 'walk-in')),
  constraint deal_value_not_negative
    check (value_usd is null or value_usd >= 0)
);

create index deals_contact_idx    on deals (contact_id);
create index deals_stage_idx      on deals (stage, created_at desc);
create index deals_owner_idx      on deals (owner_broker_id, stage) where owner_broker_id is not null;
create index deals_due_idx        on deals (next_action_at) where next_action_at is not null;
create index deals_unassigned_idx on deals (created_at desc) where owner_broker_id is null;
create index deals_close_idx      on deals (expected_close_on) where expected_close_on is not null;
create index deals_project_idx    on deals (project_id) where project_id is not null;

/* ── Activities ──────────────────────────────────────────────────────────────
   Replaces lead_events, with two additions that matter.

   `direction` — an inbound WhatsApp reply and an outbound WhatsApp blast are
   not the same event, and a timeline that cannot tell them apart cannot answer
   "did they ever actually respond".

   `occurred_at` separate from `created_at` — a call logged on Tuesday about a
   conversation that happened on Saturday should sit on Saturday in the
   timeline, while still recording when someone typed it up. */

create type activity_kind as enum (
  'note', 'call', 'email', 'whatsapp', 'sms', 'meeting',
  'stage_change', 'assignment', 'system'
);

create type activity_direction as enum ('inbound', 'outbound', 'internal');

create table activities (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  /* Null for anything about the person rather than a purchase — a change of
     phone number, a do-not-contact request. */
  deal_id      uuid references deals(id) on delete cascade,

  kind         activity_kind not null,
  direction    activity_direction not null default 'internal',

  actor_email  text,
  subject      text,
  body         text,

  from_stage   deal_stage,
  to_stage     deal_stage,

  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint stage_change_records_where_it_went
    check (kind <> 'stage_change' or to_stage is not null)
);

create index activities_contact_idx on activities (contact_id, occurred_at desc);
create index activities_deal_idx    on activities (deal_id, occurred_at desc) where deal_id is not null;
create index activities_kind_idx    on activities (kind, occurred_at desc);

/* ── Tasks ───────────────────────────────────────────────────────────────────
   Distinct from deals.next_action_at, which is one heartbeat per deal: "when
   do we next touch this". A task is a specific thing someone owes — "send the
   Airbnb projects pack to John Orr" — and there can be several at once, owned
   by different people. The follow-up queue reads both. */

create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  detail             text,

  contact_id         uuid references contacts(id) on delete cascade,
  deal_id            uuid references deals(id) on delete cascade,
  assigned_broker_id uuid references brokers(id) on delete set null,

  due_at             timestamptz,
  done_at            timestamptz,
  done_by            text,
  created_by         text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  /* A task attached to nothing is a personal reminder in the wrong tool. */
  constraint task_belongs_to_something
    check (contact_id is not null or deal_id is not null)
);

create index tasks_open_idx  on tasks (assigned_broker_id, due_at) where done_at is null;
create index tasks_deal_idx  on tasks (deal_id) where deal_id is not null;
create index tasks_due_idx   on tasks (due_at) where done_at is null and due_at is not null;

/* ── Appointments ────────────────────────────────────────────────────────────
   A time, not a date. `deals.next_action_at` says "chase him Tuesday";
   an appointment says "1:00 PM Panama, which is 11 AM where he is" — the
   distinction that decides whether Marilyn Bynum's call actually happens. */

create type appointment_kind   as enum ('call', 'showing', 'meeting', 'signing');
create type appointment_status as enum ('scheduled', 'completed', 'no_show', 'cancelled');

create table appointments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        appointment_kind not null default 'call',
  status      appointment_status not null default 'scheduled',

  contact_id  uuid not null references contacts(id) on delete cascade,
  deal_id     uuid references deals(id) on delete set null,
  /* A showing is at a development. Null for a call. */
  project_id  uuid references projects(id) on delete set null,
  broker_id   uuid references brokers(id) on delete set null,

  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text,
  notes       text,
  /* Written after: what happened, which is what makes the next call useful. */
  outcome     text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint appointment_ends_after_it_starts
    check (ends_at is null or ends_at > starts_at)
);

create index appointments_when_idx    on appointments (starts_at);
create index appointments_broker_idx  on appointments (broker_id, starts_at) where broker_id is not null;
create index appointments_contact_idx on appointments (contact_id, starts_at desc);
create index appointments_open_idx    on appointments (starts_at) where status = 'scheduled';

/* ── Which developments a buyer saw ──────────────────────────────────────────
   The 45 projects have been in this database since 0001 and the CRM has never
   once referred to them. This is the join that answers the question a broker
   is actually asked on the second call: "what did you think of the ones I
   sent?" — and the one that stops the same development being pitched twice. */

create type showing_state as enum ('suggested', 'sent', 'shortlisted', 'shown', 'rejected');

create table deal_projects (
  deal_id     uuid not null references deals(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  state       showing_state not null default 'suggested',
  feedback    text,
  shown_on    date,
  created_at  timestamptz not null default now(),

  primary key (deal_id, project_id)
);

create index deal_projects_project_idx on deal_projects (project_id, state);

/* ── updated_at ──────────────────────────────────────────────────────────────
   activities has none: like lead_events it is append-only, and a column
   tracking updates would only ever mislead. deal_projects has none for the
   same reason its history lives in activities. */

do $$
declare t text;
begin
  foreach t in array array['contacts', 'deals', 'tasks', 'appointments']
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

/* ── Row level security ──────────────────────────────────────────────────────
   Same stance as leads in 0001 and lead_events in 0005: enabled with NO
   policy, which denies every role reaching Postgres through PostgREST,
   including the publishable key in the client bundle. These tables hold every
   phone number, budget and private note the business has. Reads and writes go
   through the service role inside server code, where the viewer scoping in
   lib/crm lives. */

alter table contacts      enable row level security;
alter table deals         enable row level security;
alter table activities    enable row level security;
alter table tasks         enable row level security;
alter table appointments  enable row level security;
alter table deal_projects enable row level security;

comment on table contacts is
  'One row per human, forever. Deals, activities and appointments hang off it.';
comment on table deals is
  'A thing a contact might buy. Many per contact over time.';
comment on column deals.probability is
  '0-100. Defaulted from the stage by the app, overridable by the broker.';
comment on table deal_projects is
  'Which developments were suggested, sent, shown or rejected, and what they said.';
