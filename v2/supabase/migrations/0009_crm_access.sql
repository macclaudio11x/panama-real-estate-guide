/* =============================================================================
   0009_crm_access.sql
   =============================================================================
   Until now the admin had authentication but no authorisation. `requireAdmin`
   checked that a Supabase Auth user existed and stopped there, so any account
   on the project could read every lead — full names, phone numbers, budgets.
   That was adequate while the user list was one person. It stops being
   adequate the moment a broker gets a login.

   This migration gives `brokers` the three columns that turn it from a
   directory into an access list:

     auth_user_id — which login this broker signs in as
     role         — what they may do
     is_active    — whether they may do it today

   Why extend `brokers` rather than add a `crm_users` table: brokers are
   already the thing a lead is assigned to (`leads.assigned_broker_id`) and the
   thing a project routes through (`projects.broker_id`). A second table would
   mean two identities per person and a join to answer "whose lead is this".
   The row is never rendered on the public site — nothing outside /admin reads
   this table except the default-broker lookup in lib/leads.ts — so an admin
   who is not a practising broker sitting in it costs nothing.

   ⚠️ APPLY THIS BEFORE DEPLOYING THE CODE THAT ACCOMPANIES IT.
   There is no migration runner in this repo and no DDL path from the dev
   machine. Paste this into the Supabase SQL editor. `lib/admin-auth.ts`
   selects `role` and `is_active` explicitly, so until the columns exist every
   /admin route throws on sign-in.
   ============================================================================= */

/* ── Identity ────────────────────────────────────────────────────────────────
   Nullable: a broker can exist as a routing target and a name on a lead
   without ever being given a login, which is how the four rows this table is
   about to gain will start life.

   `on delete set null` rather than cascade — deleting an auth user must revoke
   the login, never delete the broker row that leads still point at. */

alter table brokers
  add column if not exists auth_user_id uuid unique
    references auth.users(id) on delete set null;

/* ── Authorisation ───────────────────────────────────────────────────────────
   Two roles, because there are only two questions worth asking: can this
   person see leads that are not theirs, and can they hand a lead to someone
   else. Admin yes, broker no.

   Default 'broker' is the safe default — a row created without a considered
   role gets the narrower one. */

alter table brokers
  add column if not exists role text not null default 'broker';

alter table brokers
  drop constraint if exists broker_role_known;

alter table brokers
  add constraint broker_role_known
    check (role in ('admin', 'broker'));

/* Revoking access has to be reversible and has to preserve history. Deleting
   the broker row would strip the name off every lead they ever worked, so
   departure is a flag, not a delete. Checked on every request, so flipping it
   ends the session's usefulness immediately even though the cookie survives. */

alter table brokers
  add column if not exists is_active boolean not null default true;

/* The sign-in path looks a broker up by auth user on every admin request.
   Partial: rows without a login never participate in that lookup. */

create index if not exists brokers_auth_user_idx on brokers (auth_user_id)
  where auth_user_id is not null;

/* ── Scoped queues ───────────────────────────────────────────────────────────
   A broker's inbox, board and follow-up queue are all "my leads, by status" or
   "my leads, by due date". Without these both go to a full scan of `leads`
   filtered in memory. Small now at 15 rows; the index is here so it is already
   right when it isn't. */

create index if not exists leads_broker_status_idx
  on leads (assigned_broker_id, status, created_at desc)
  where assigned_broker_id is not null;

create index if not exists leads_broker_due_idx
  on leads (assigned_broker_id, next_action_at)
  where next_action_at is not null;

/* The unassigned pool, which is an admin-only view and the reason 14 of the
   first 15 leads went untouched — nothing surfaced them as anyone's job. */

create index if not exists leads_unassigned_idx
  on leads (created_at desc)
  where assigned_broker_id is null;

comment on column brokers.auth_user_id is
  'Supabase Auth user this broker signs in as. Null means a broker who can be '
  'assigned leads but cannot log in.';

comment on column brokers.role is
  'admin sees and reassigns every lead; broker sees only leads assigned to them.';

comment on column brokers.is_active is
  'False revokes admin access without deleting the row, so past assignments '
  'and lead_events keep resolving to a name.';

/* ── Seeding the first admin ─────────────────────────────────────────────────
   Cannot be done in SQL alone: the auth user has to exist first, and creating
   one is an Auth API call, not an insert. After applying the rest of this
   file, run the two statements below with the real values.

   `charles@panamarealestateguide.com` already signs in (it is the actor on the
   existing lead_events) and already has an auth.users row, so this is a lookup
   and an insert, not a new account.

     insert into brokers (slug, name, email, role, is_active, auth_user_id)
     select
       'charles',
       'Charles',
       u.email,
       'admin',
       true,
       u.id
     from auth.users u
     where u.email = 'charles@panamarealestateguide.com'
     on conflict (slug) do update
       set role = 'admin', auth_user_id = excluded.auth_user_id;

   Verify exactly one admin came back before signing out of anything:

     select slug, name, email, role, is_active, auth_user_id is not null as can_log_in
     from brokers order by role, name;

   Further brokers are created from /admin/brokers, which makes the auth user
   and the row together. This block exists only for the first one, because
   that page requires an admin to already exist to open it. */
