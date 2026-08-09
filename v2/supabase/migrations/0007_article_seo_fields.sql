-- Search metadata, separable from the on-page headline and standfirst.
--
-- `title` and `dek` were doing double duty: title as both the H1 and the
-- <title>, dek as the standfirst, the listing-card copy and the meta
-- description. Those jobs have different budgets, roughly 60 and 160
-- characters against prose that is free to run longer, and different aims: a
-- meta description is a pitch, a standfirst leads into the article.
--
-- Both columns are nullable and the routes fall back to title/dek, so an
-- article that sets neither behaves exactly as it does today. Leave them null
-- unless a page genuinely wants to diverge. A backfilled copy of the title is
-- a second thing to keep in sync, and the first edited headline would silently
-- stop matching what search results show.

alter table articles
  add column seo_title        text,
  add column meta_description text;

comment on column articles.seo_title is
  'Search-result title. Null means use `title`. Keep at or under 60 characters: the routes emit it absolutely, with no site-name suffix appended.';

comment on column articles.meta_description is
  'Search-result description. Null means use `dek`. Keep between 140 and 160 characters.';
