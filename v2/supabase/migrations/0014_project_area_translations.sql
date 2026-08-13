/* =============================================================================
   0014_project_area_translations.sql — catalogue prose in another language
   =============================================================================
   The companion to 0013. Same shape, same review gate, different parents.

   The rule that matters here: EDITORIAL FIELDS ONLY. Prices, bed counts, m²,
   amenities, delivery dates, coordinates and title status are language-neutral
   facts and must not be duplicated into these tables. A price that exists in
   two places is a price that will eventually disagree with itself, and the
   whole argument of this site is that our numbers are checked.

   So a German project page reads its prose from here and everything else
   straight from `projects`. One price, one source of truth, every language.

   Neither table carries a slug. Area and project slugs are proper nouns and do
   not translate: /de/projekte/bioma-costa-del-este is the German URL, and
   `bioma-costa-del-este` still comes from the parent row.

   Neither carries reviewer_id either. The public accuracy badge is an article
   feature; these pages have never rendered one and this migration is not the
   place to invent it. The INTERNAL language check applies exactly as it does
   to articles, because catalogue prose makes price and title claims too.

   ⚠️ Apply before deploying the code that accompanies it. Depends on 0013 only
   for its conventions, not structurally; either order works.
   ============================================================================= */

/* ── Projects ────────────────────────────────────────────────────────────────
   Fields mirror the editorial columns 0002 added to `projects`, minus the
   catalogue facts it added alongside them (architect, storeys, total_units,
   phases, price_source_url, price_checked_on all stay language-neutral). */

create table project_translations (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  lang              text not null,

  hook              text,   -- the one-line reason to care
  summary           text,
  body              text,
  location_note     text,   -- what is walkable, how far to the airport
  suits             text,   -- who it is for
  drawbacks         text,   -- and who it is not for
  buying_note       text,   -- deposit structure, financing, payment schedule
  title_note        text,   -- the central claim; see the warning below
  faqs              jsonb not null default '[]'::jsonb,

  /* Matches `projects.published` rather than 0013's publish_status, because
     each translation table follows the convention of the table it hangs off. */
  published         boolean not null default false,

  translator_id     uuid references authors(id),
  checked_by        uuid references authors(id),
  checked_on        date,

  /* `projects` has no editorial `updated_on` the way `articles` does, so
     staleness is tracked against updated_at and the type follows. */
  source_updated_at timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint project_translations_unique_per_lang
    unique (project_id, lang),

  constraint project_translations_known_lang
    check (lang in ('de', 'es')),

  /* The same structural review gate as 0013, and for the same reason.
     translator_id is required at publish because the independence check below
     compares against it, and a NULL comparison in a CHECK constraint passes
     silently. */
  constraint project_translations_check_before_publish
    check (
      not published
      or (translator_id is not null
          and checked_by is not null
          and checked_on is not null)
    ),

  constraint project_translations_check_is_independent
    check (checked_by is null or checked_by <> translator_id)
);

/* ── Areas ───────────────────────────────────────────────────────────────────
   Mirrors the editorial columns from 0001 and 0003. `sources` is shared with
   the parent row and deliberately absent, same as in 0013. */

create table area_translations (
  id                  uuid primary key default gen_random_uuid(),
  area_id             uuid not null references areas(id) on delete cascade,
  lang                text not null,

  positioning         text,
  blurb               text,
  cost_of_living_note text,   -- rent, utilities, groceries
  getting_around_note text,   -- airport distance, road quality, car-required
  suits               text,
  drawbacks           text,
  title_note          text,
  faqs                jsonb not null default '[]'::jsonb,

  /* `areas` has no publish flag: an unwritten area renders as null and the UI
     hides it. A translation needs one, because a half-translated area must not
     render at all rather than render half in English. */
  published           boolean not null default false,

  translator_id       uuid references authors(id),
  checked_by          uuid references authors(id),
  checked_on          date,

  source_updated_at   timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint area_translations_unique_per_lang
    unique (area_id, lang),

  constraint area_translations_known_lang
    check (lang in ('de', 'es')),

  constraint area_translations_check_before_publish
    check (
      not published
      or (translator_id is not null
          and checked_by is not null
          and checked_on is not null)
    ),

  constraint area_translations_check_is_independent
    check (checked_by is null or checked_by <> translator_id)
);

/* ── Indexes ─────────────────────────────────────────────────────────────────
   The unique constraints cover the hot read (parent + lang). These two cover
   the operational queries: what is stale, and what is waiting to be checked. */

create index project_translations_stale_idx
  on project_translations (lang, source_updated_at)
  where published;

create index project_translations_unchecked_idx
  on project_translations (lang, updated_at)
  where checked_on is null;

create index area_translations_stale_idx
  on area_translations (lang, source_updated_at)
  where published;

create index area_translations_unchecked_idx
  on area_translations (lang, updated_at)
  where checked_on is null;

/* ── updated_at ──────────────────────────────────────────────────────────────
   Same reasoning as 0013: 0001's DO block ran once over a fixed array and does
   not know about these tables. */

create trigger project_translations_set_updated_at
  before update on project_translations
  for each row execute function set_updated_at();

create trigger area_translations_set_updated_at
  before update on area_translations
  for each row execute function set_updated_at();

/* ── RLS ─────────────────────────────────────────────────────────────────────
   `public_read_projects` gates on published; these mirror it. Areas are
   publicly readable in full today (`public_read_areas ... using (true)`), but
   the translations are NOT, because an unchecked translation is exactly the
   thing the review gate exists to keep off the site. Deliberate divergence
   from the parent table, noted here so it does not read as an oversight. */

alter table project_translations enable row level security;
alter table area_translations    enable row level security;

create policy public_read_project_translations on project_translations
  for select using (published);

create policy public_read_area_translations on area_translations
  for select using (published);

comment on table project_translations is
  'Project prose in one target language. Editorial fields only — prices, '
  'amenities, delivery dates and title status stay on projects. See '
  'docs/localisation-plan.md.';

comment on table area_translations is
  'Area prose in one target language. Editorial fields only. See '
  'docs/localisation-plan.md.';

comment on column project_translations.title_note is
  'Translated with the §6 glossary in hand. Panamanian title vocabulary keeps '
  'its Spanish terms (derechos posesorios, titulo de propiedad) with a gloss; '
  'substituting a German legal term makes a German reader apply German law to '
  'a Panamanian parcel.';
