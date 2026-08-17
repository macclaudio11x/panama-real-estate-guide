/* =============================================================================
   0015_lead_lang.sql
   =============================================================================
   The German tree needs the broker to know which language to open the call in,
   before they dial rather than after the other person answers.

   0006 added `intent` to answer "how much is known about this lead". This
   answers a different question the same row has to carry: "what language was
   the person reading when they decided to contact us". Those are separate
   facts and neither implies the other, so this is a column rather than another
   intent value.

   Why not read it off the browser instead: GA4's built-in `language` dimension
   and the Accept-Language header both report the *visitor's browser*, which is
   frequently English on a German reader's machine and is never a reliable
   statement about the page. The page knows its own locale at render time. That
   is the fact worth storing, and it is only available at the point of
   submission.

   Backfilling every existing row to 'en' is not a guess. Until the /de/ routes
   exist, every form on this site is served in English, so 'en' is true of all
   of them by construction.

   ⚠️ Apply before the German contact form ships. A lead that arrives without a
   language is indistinguishable from an English one, and the broker finds out
   on the call.
   ============================================================================= */

alter table leads
  add column if not exists lang text not null default 'en';

/* Deliberately different from `article_translations_known_lang`, which allows
   only ('de','es') because English content lives in the base table and has no
   translation row. Here 'en' is a real, and currently universal, value. Do not
   "harmonise" the two lists: they are answering different questions. */
alter table leads
  drop constraint if exists lead_lang_known;

alter table leads
  add constraint lead_lang_known
    check (lang in ('en', 'de', 'es'));

comment on column leads.lang is
  'Locale of the page the lead was submitted from, set server-side at submission '
  'from the route, not from Accept-Language or any browser signal. Tells the '
  'broker which language to open the call in. Extend the lead_lang_known '
  'constraint when a locale actually ships, so a typo cannot quietly create a '
  'fourth language nobody is staffed for.';

/* Supports the query the broker's queue actually runs: the newest leads in one
   language. Mirrors leads_intent_created_idx from 0010 rather than indexing
   lang alone, which would be close to useless at this cardinality. */
create index if not exists leads_lang_created_idx on leads (lang, created_at desc);
