/* =============================================================================
   0006_lead_intent.sql
   =============================================================================
   Not every lead is asking for the same thing, and until now the table could
   not tell the difference.

   The contact form and the project forms ask for a broker call: the person has
   given a budget and a timeline and expects the phone to ring. The article
   forms ask for an email address and nothing else, from a reader who is
   usually a long way from buying and who asked for a guide, not a salesman.

   Putting both down the same pipe means a broker calls someone who wanted a
   PDF, which is the quickest way to lose a buyer who would have converted a
   year later. It also makes the conversion rate unreadable: 40 leads means
   nothing if you cannot see that 32 of them were reading about SIM cards.

   Default 'shortlist' so every row already in the table keeps the meaning it
   was collected under — every lead before this migration came from a form that
   asked for a broker call.
   ============================================================================= */

alter table leads
  add column if not exists intent text not null default 'shortlist';

/* Dropped first so the migration can be re-run against a database that already
   has it — the same defensive shape as the `add column if not exists` above. */
alter table leads
  drop constraint if exists lead_intent_known;

alter table leads
  add constraint lead_intent_known
    check (intent in ('shortlist', 'project', 'brief'));

comment on column leads.intent is
  'What the person asked for: shortlist = full contact form, project = a named '
  'development, brief = article email capture (cold, do not cold-call).';

/* The broker's queue is "new leads that want a call, newest first", which is
   this index exactly. Without it that view degrades into a full scan the day
   the brief leads outnumber the real ones — which is the point of collecting
   them. */
create index if not exists leads_intent_idx on leads (intent, created_at desc);
