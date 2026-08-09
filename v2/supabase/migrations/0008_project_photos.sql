-- The last thing still living only in data/airtable.json.
--
-- Everything else the site renders for a project or an area was already in
-- Supabase: 31 projects, 18 areas and 109 unit models, matching the JSON with
-- zero field mismatches. beds_min, beds_max and size_from_m2 do not need
-- columns either, because they derive from unit_models exactly (checked across
-- all 31 projects). Photos were the one exception, so the site had to read the
-- file at build time and a new development meant a commit and a deploy.
--
-- Shape is [{ "src": "/projects/<slug>/01.webp", "alt": null }], ordered. The
-- path is relative to the media base, the same convention articles use for
-- og_image_path, so R2 stays the store and the database only holds the key.

alter table projects
  add column if not exists photos jsonb not null default '[]'::jsonb;

comment on column projects.photos is
  'Ordered [{src, alt}]. src is a media-base-relative path, e.g. /projects/<slug>/01.webp. First photo is the hero and the og:image.';
