/* =============================================================================
   0010_outreach_intent.sql
   =============================================================================
   0006 gave every lead an `intent` describing which form produced it, on the
   assumption that a lead is something that arrives. The Do Panama WhatsApp and
   call campaign inverts that: 86 people who never filled in anything on this
   site, contacted outbound from an ad list.

   None of the three existing values is true of them, and `shortlist` — the
   closest by shape — specifically means "came through the full contact form
   with a budget and a timeline". Filing a cold outbound contact under it would
   put an unqualified stranger in the same bucket as the site's best-qualified
   enquiries, and quietly destroy the one number the intent column exists to
   protect: what the website itself actually converts.

   So: a fourth value, and the reporting stays readable.

   ⚠️ Apply together with 0009_crm_access.sql, before the import runs.
   ============================================================================= */

alter table leads
  drop constraint if exists lead_intent_known;

alter table leads
  add constraint lead_intent_known
    check (intent in ('shortlist', 'project', 'article', 'outreach'));

comment on column leads.intent is
  'Which form produced the lead, and therefore how much is known about it: '
  'shortlist = full contact form with budget and timeline, project = a named '
  'development, article = short in-guide form, wants a broker but is '
  'unqualified, outreach = contacted by us from a campaign list, never filled '
  'in anything here.';

/* Reporting reads "inbound" as everything that is not outreach, so the index
   is on the column the dashboards will actually group by. */

create index if not exists leads_intent_created_idx on leads (intent, created_at desc);
