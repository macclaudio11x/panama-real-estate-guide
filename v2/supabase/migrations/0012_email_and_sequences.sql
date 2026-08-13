/* =============================================================================
   0012_email_and_sequences.sql — a mailbox the CRM can see
   =============================================================================
   Sending is the easy half. The half that makes a CRM worth opening is that a
   reply lands against the person who sent it, without anyone forwarding
   anything — which is why this is built on IMAP rather than a transactional
   API. Resend can post a message; it cannot tell you George Walker answered.

   Three things this has to get right:

   `message_id` / `in_reply_to` — threading is done on the RFC-5322 headers,
   not on subject lines. "Re: Re: Fwd: Your Panama enquiry" is not a key, and
   two buyers replying to the same campaign would collide on one.

   `imap_uid` + folder + uidvalidity — the sync has to resume where it stopped
   without re-reading a mailbox every poll, and has to notice when the server
   invalidates its UIDs, which is the one case where resuming silently skips
   mail.

   Unmatched mail is kept, not dropped. An email from an address nobody
   recognises is how a referral arrives.

   ⚠️ Apply after 0011_crm_objects.sql.
   ============================================================================= */

/* ── Synced mail ─────────────────────────────────────────────────────────────
   Both directions in one table: a thread is only readable if the sent and the
   received messages sort together. */

create type email_direction as enum ('inbound', 'outbound');

create type email_send_state as enum (
  'queued',     -- ours, waiting for the sender
  'sent',       -- handed to the SMTP server
  'failed',     -- SMTP refused it; `error` says why
  'received'    -- theirs, pulled by the IMAP poll
);

create table email_messages (
  id            uuid primary key default gen_random_uuid(),

  direction     email_direction not null,
  state         email_send_state not null,

  /* RFC-5322 Message-ID, without the angle brackets. Unique because the same
     message arriving twice — a re-poll, a Sent-folder copy of something we
     sent — must not become two rows. Null only while an outbound message is
     queued and has not been given one yet. */
  message_id    text unique,
  in_reply_to   text,
  /* The root Message-ID of the conversation, copied down every reply so a
     whole thread is one indexed lookup rather than a recursive walk. */
  thread_key    text,

  from_email    text not null,
  from_name     text,
  to_emails     text[] not null default '{}',
  cc_emails     text[] not null default '{}',

  subject       text,
  body_text     text,
  body_html     text,
  has_attachments boolean not null default false,

  /* Null until an unmatched inbound message is claimed by a human. */
  contact_id    uuid references contacts(id) on delete set null,
  deal_id       uuid references deals(id) on delete set null,
  /* The timeline entry mirroring this message, so the two cannot drift. */
  activity_id   uuid references activities(id) on delete set null,

  /* Which broker's mailbox this came from or went out as. */
  broker_id     uuid references brokers(id) on delete set null,

  imap_uid      bigint,
  imap_folder   text,

  sent_at       timestamptz,
  received_at   timestamptz,
  error         text,

  created_at    timestamptz not null default now(),

  /* A UID only identifies a message within one folder of one mailbox. */
  constraint email_uid_unique_per_folder unique (imap_folder, imap_uid),
  constraint outbound_has_a_recipient
    check (direction = 'inbound' or cardinality(to_emails) > 0)
);

create index email_thread_idx     on email_messages (thread_key, coalesce(sent_at, received_at));
create index email_contact_idx    on email_messages (contact_id, coalesce(sent_at, received_at) desc)
  where contact_id is not null;
create index email_unmatched_idx  on email_messages (received_at desc)
  where contact_id is null and direction = 'inbound';
create index email_queue_idx      on email_messages (created_at)
  where state = 'queued';
create index email_from_idx       on email_messages (lower(from_email));

/* ── Where the IMAP poll got to ──────────────────────────────────────────────
   One row per mailbox folder. `uid_validity` is the guard: when the server
   changes it, every stored UID is meaningless and the folder must be re-read
   from the beginning rather than resumed. */

create table email_sync_state (
  id            uuid primary key default gen_random_uuid(),
  broker_id     uuid references brokers(id) on delete cascade,
  folder        text not null,
  uid_validity  bigint,
  last_uid      bigint not null default 0,
  last_polled_at timestamptz,
  last_error    text,

  unique (broker_id, folder)
);

/* ── Templates ───────────────────────────────────────────────────────────────
   The message bank already exists — it is written out in the tracker sheet's
   SCRIPTS tab, in several versions each, precisely because sending identical
   text at volume is what gets a sender blocked. That rotation is the reason
   `body_variants` is an array rather than one body: the sender picks one, and
   the reason it must is recorded here rather than in someone's memory. */

create type message_channel as enum ('email', 'whatsapp');

create table message_templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  channel       message_channel not null default 'email',

  subject       text,
  /* Two or more phrasings of the same message. {{first_name}} style
     placeholders, resolved against the contact and deal at send time. */
  body_variants text[] not null,

  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint template_has_a_body check (cardinality(body_variants) > 0),
  constraint email_template_has_a_subject
    check (channel <> 'email' or subject is not null)
);

/* ── Sequences ───────────────────────────────────────────────────────────────
   The cadence is already specified in the tracker: follow-up #1 three days
   after no reply, follow-up #2 seven days later, then mark cold. This encodes
   that rather than reinventing it.

   `stop_on_reply` defaults true and should stay true. A sequence that keeps
   sending after someone answers is the single fastest way to make a business
   look automated, and the tracker's own note — that a lead who said yes and is
   still waiting is the most expensive kind of lost lead — is the same failure
   seen from the other side. */

create table sequences (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  channel       message_channel not null default 'email',
  is_active     boolean not null default false,
  stop_on_reply boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table sequence_steps (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references sequences(id) on delete cascade,
  step_no       smallint not null,
  /* Days after the previous step — or after enrolment, for step 1. */
  delay_days    smallint not null default 3,
  template_id   uuid not null references message_templates(id) on delete restrict,

  unique (sequence_id, step_no),
  constraint step_delay_not_negative check (delay_days >= 0)
);

create type enrollment_state as enum ('active', 'completed', 'stopped');

create table sequence_enrollments (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references sequences(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  deal_id       uuid references deals(id) on delete cascade,

  state         enrollment_state not null default 'active',
  current_step  smallint not null default 0,
  next_run_at   timestamptz,
  stopped_reason text,

  enrolled_by   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  /* Enrolling the same person in the same sequence twice would double every
     message they receive. */
  unique (sequence_id, contact_id)
);

/* The runner's only query: what is due. */
create index enrollments_due_idx on sequence_enrollments (next_run_at)
  where state = 'active' and next_run_at is not null;
create index enrollments_contact_idx on sequence_enrollments (contact_id);

/* ── updated_at ──────────────────────────────────────────────────────────── */

do $$
declare t text;
begin
  foreach t in array array[
    'message_templates', 'sequences', 'sequence_enrollments'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

/* ── Row level security ──────────────────────────────────────────────────────
   These tables hold the body of every email to and from a client. Same stance
   as everything else: enabled, no policy, service role only. */

alter table email_messages       enable row level security;
alter table email_sync_state     enable row level security;
alter table message_templates    enable row level security;
alter table sequences            enable row level security;
alter table sequence_steps       enable row level security;
alter table sequence_enrollments enable row level security;

comment on table email_messages is
  'Both directions of synced mail. Inbound arrives via the IMAP poll and is '
  'matched to a contact by from address, then by thread_key.';
comment on column email_sync_state.uid_validity is
  'When the server changes this, stored UIDs are meaningless and the folder '
  'must be re-read from the start rather than resumed.';
comment on column message_templates.body_variants is
  'Several phrasings of one message. Sending identical text at volume is what '
  'gets a sender blocked — the sender rotates these.';
