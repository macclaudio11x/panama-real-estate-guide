/* =============================================================================
   0006_lead_intent.sql
   =============================================================================
   Every lead here wants the same thing — a licensed broker to get in touch —
   but they do not all arrive carrying the same information, and until now the
   table could not tell the difference.

   A lead off the contact form has already given a budget and a timeline, so a
   broker can build a shortlist before dialling. A lead off an article form
   gave a name, an email and maybe a number, because that is all a three-field
   box in the middle of a guide can reasonably ask for. Both expect a call.
   Only one of them can be prepared for.

   Recording which is which is what stops a broker opening a lead expecting
   qualifiers that were never asked for, and what makes the conversion rate
   readable: 40 leads means nothing if you cannot see which form produced them
   or which guide they were reading at the time.

   Default 'shortlist' so every row already in the table keeps the meaning it
   was collected under — every lead before this migration came from the full
   contact form or a project page.
   ============================================================================= */

alter table leads
  add column if not exists intent text not null default 'shortlist';

/* Dropped first so the migration can be re-run against a database that already
   has it — the same defensive shape as the `add column if not exists` above. */
alter table leads
  drop constraint if exists lead_intent_known;

alter table leads
  add constraint lead_intent_known
    check (intent in ('shortlist', 'project', 'article'));

comment on column leads.intent is
  'Which form produced the lead, and therefore how much is known about it: '
  'shortlist = full contact form with budget and timeline, project = a named '
  'development, article = short in-guide form, wants a broker but is unqualified.';

/* Supports the two views that matter: the broker working newest-first within a
   kind of lead, and counting article leads against shortlist leads to see
   whether the in-guide forms are pulling their weight. */
create index if not exists leads_intent_idx on leads (intent, created_at desc);
