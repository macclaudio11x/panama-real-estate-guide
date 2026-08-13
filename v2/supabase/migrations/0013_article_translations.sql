/* =============================================================================
   0013_article_translations.sql — the same article, in another language
   =============================================================================
   German first, Spanish queued behind it. See docs/localisation-plan.md.

   A side table rather than a `lang` column on `articles`, because every
   existing query, RLS policy, publish gate, lint rule and MCP tool assumes one
   row per article. A column would require auditing all of them; a side table
   leaves them untouched and still answers "which pages have German, and which
   German pages are stale" in a single query.

   Two fields carry most of the operational weight here, and both exist because
   of things this repo has already got wrong:

     source_updated_on — the English row's `updated_on` at the moment the
       translation was written. When the English page is corrected and the
       German is not, the gap is queryable instead of invisible. This repo has
       twice shipped the retracted version of a page; without this field the
       translated site silently becomes the place the retraction never reached.

     checked_by / checked_on — the language check (§9a of the plan). NOT the
       public reviewer badge. The machine-translated /de/ tree that this whole
       project exists to replace sat live for months because nobody who reads
       German ever looked at it. Bad translation fails silently: broken English
       is obvious to everyone, fluent and confident and wrong German is
       invisible to a team that does not read German.

   ⚠️ Apply before deploying the code that accompanies it.
   ============================================================================= */

/* ── The table ───────────────────────────────────────────────────────────────
   Editorial fields only. Everything language-neutral (author, area, category,
   sources, images, read time) stays on `articles` and is read through the
   foreign key. Duplicating it here is how the two languages drift apart.

   `sources` is deliberately absent. Both language versions cite the same
   primary documents — ANATI, Registro Público, MEF, Gaceta Oficial — and most
   of them are Spanish-language government PDFs regardless of what language the
   article is written in. One array, shared, is also the only way a correction
   to a citation reaches every language at once. */

create table article_translations (
  id                uuid primary key default gen_random_uuid(),
  article_id        uuid not null references articles(id) on delete cascade,
  lang              text not null,
  slug              text not null,

  title             text not null,
  dek               text,
  seo_title         text,
  meta_description  text,
  body              text,
  faqs              jsonb not null default '[]'::jsonb,

  status            publish_status not null default 'draft',

  /* Who wrote it. */
  translator_id     uuid references authors(id),

  /* PUBLIC accuracy badge. Renders on the page with an avatar and a licence
     string, and is an E-E-A-T claim to the reader. Optional: a translation can
     be correct without carrying a credentialled signature. */
  reviewer_id       uuid references authors(id),
  reviewed_on       date,

  /* INTERNAL language check. Never renders anywhere. Mandatory to publish.
     A translation can carry a licensed reviewer and still be wrong, and can be
     right without one, which is why this cannot be the same field as above. */
  checked_by        uuid references authors(id),
  checked_on        date,

  source_updated_on date,
  updated_on        date,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  /* One translation per language per article. */
  constraint article_translations_unique_per_lang
    unique (article_id, lang),

  /* Slugs are unique within a language, not globally. /de/leben/x and
     /es/vivir/x are different pages and both are allowed. */
  constraint article_translations_unique_slug
    unique (lang, slug),

  /* Bare language codes only, matching the hreflang rule (§4 of the plan).
     Never de-DE or es-PA: one German version serves Germany, Austria and
     Switzerland, and a regional code tells Google to suppress it in two of
     them. Extend this list when a locale is actually being built, so a typo
     cannot quietly create a third tree nobody is maintaining. */
  constraint article_translations_known_lang
    check (lang in ('de', 'es')),

  /* ── The publish gate ──────────────────────────────────────────────────────
     This is the constraint the whole review step rests on. A translation row
     physically cannot reach 'published' without a completed language check,
     which makes the gate structural rather than a habit somebody remembers
     under deadline.

     `translator_id` is required here too, and not merely for the credit. The
     independence check below compares against it, and SQL comparisons to NULL
     yield NULL, which a CHECK constraint treats as satisfied. Without this
     clause, clearing translator_id would let one person check their own
     translation and the constraint would raise nothing at all. Draft rows stay
     permissive, because a row often exists before a translator is assigned. */
  constraint article_translations_check_before_publish
    check (
      status <> 'published'
      or (translator_id is not null
          and checked_by is not null
          and checked_on is not null)
    ),

  /* The translator cannot sign off their own work. This is the single most
     common way a review gate gets quietly skipped, and the point of the check
     is a second pair of eyes rather than a second timestamp. */
  constraint article_translations_check_is_independent
    check (checked_by is null or checked_by <> translator_id),

  /* If the reviewer badge is claimed, it carries a date, and it is the date
     they actually read the page. Copied verbatim from `review_needs_date` on
     articles rather than tightened, so the two tables answer the same
     question the same way. */
  constraint translation_review_needs_date
    check (reviewer_id is null or reviewed_on is not null)
);

/* ── Indexes ─────────────────────────────────────────────────────────────────
   The unique constraints already index (article_id, lang) and (lang, slug),
   which covers the two hot reads: "give me the German version of this article"
   and "resolve this German URL". */

/* The staleness query: German rows whose English source has moved on. Partial,
   because an unpublished row being stale is not interesting. */
create index article_translations_stale_idx
  on article_translations (lang, source_updated_on)
  where status = 'published';

/* The Phase 1b queue: written but not yet checked. */
create index article_translations_unchecked_idx
  on article_translations (lang, updated_at)
  where checked_on is null;

/* ── updated_at ──────────────────────────────────────────────────────────────
   Reuse the existing trigger function. 0001 creates these through a DO block
   over a fixed array of table names, which ran once and does not know about
   this table, so it is written out here under the same %I_set_updated_at
   naming the loop produced. */

create trigger article_translations_set_updated_at
  before update on article_translations
  for each row execute function set_updated_at();

/* ── RLS ─────────────────────────────────────────────────────────────────────
   Mirrors `articles` exactly: anonymous reads see published rows only,
   everything else is service-role. Diverging from the English policy would be
   a way to accidentally expose German drafts that the English gate hides. */

alter table article_translations enable row level security;

create policy public_read_article_translations on article_translations
  for select using (status = 'published');

comment on table article_translations is
  'One article in one target language. Editorial fields only; catalogue facts, '
  'sources and images stay on articles. See docs/localisation-plan.md.';

comment on column article_translations.checked_by is
  'Internal language check (plan §9a). Never rendered. Required to publish, and '
  'must not be the translator. Distinct from reviewer_id, which is the public '
  'accuracy badge.';

comment on column article_translations.source_updated_on is
  'The English row''s updated_on when this translation was written. A gap '
  'against articles.updated_on means the English page has been corrected and '
  'this one has not.';
