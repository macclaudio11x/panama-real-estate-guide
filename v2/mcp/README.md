# Panama Real Estate Guide — MCP server

Publishes and edits site content without a git push.

```bash
cd v2/mcp && npm install
```

Registered for this repo in `.mcp.json` at the repo root. Restart Claude Code
after adding it; the server appears as `panama`.

## Why this works at all

The site used to bake content into the build twice over:

- article titles, deks and read times were a hardcoded array in
  `v2/lib/content.ts`, which is in git, so editing a headline meant a commit;
- every route was statically generated with no `revalidate`, so a Supabase edit
  did not reach production until the next deploy (~45 minutes).

Both are fixed. `v2/lib/articles.ts` reads the index from the live `articles`
table, and every content route exports `revalidate = 60`. A write through this
server is on the live site inside a minute.

`data/airtable.json` still supplies project and area *facts* — price, units,
photos, the area slug list. Those remain a sync, not a CMS. Editorial prose for
areas and projects is in Supabase and is editable here.

## Credentials

Read from `v2/.env.local` (gitignored). Already present: the Supabase URL and
service-role key, and the four R2 variables. **You need to add one line:**

```
GEMINI_API_KEY=...
```

Same key the other sites use. Without it every tool works except
`generate_image`.

The service-role key bypasses RLS, which is the only way to see drafts and to
write. Run this server locally over stdio only — never expose it on a network.

## Tools

| | |
|---|---|
| `content_audit` | Health report across all three tables. Start here. |
| `list_articles` | Filter by category, status, `needs_sources`, `needs_image`, `max_words`. |
| `get_article` · `create_article` · `update_article` | Read and write. Partial patches. |
| `set_article_status` · `delete_article` | Publish, unpublish, remove. |
| `lint_article` | House rules, no write. |
| `list_areas` · `get_area` · `update_area` | Area page prose. |
| `list_projects` · `get_project` · `update_project` | Project page prose and the published flag. |
| `generate_image` | Gemini → resize + WebP → R2 → attached to the article. |
| `set_article_image` · `upload_media` | Attach or upload by hand. |
| `list_authors` · `list_categories` | Reference. |

## The gates, and why they exist

Fifty-four of this site's pages once carried fabricated evidence — invented
crime statistics, an invented advisory firm, testimonials attributed to people
who do not exist. The cleanup took weeks. These gates are the residue.

**Publishing is blocked** when an article has no sources, no dek, or a body
under 400 words. `force: true` overrides it; if you use that, say why.

**Rejected outright**, publish or draft:

- a source missing `url` or `label`, or using `checked_on` instead of the
  camelCase `checkedOn` the template actually reads;
- a body containing its own `## Frequently asked questions` heading — the
  template appends one from `faqs`, so this ships the section twice.

**Warned about**: more than three em-dashes, trailing-dash punchlines, a body
under 900 words, a source with no `checkedOn` date.

Gemini returns a ~1.7 MB 2752px JPEG at 300 DPI, which is a print asset. Every
generated image is resized to 1600px and re-encoded as WebP before upload —
around 10 KB for flat vector art, and still twice the widest slot the article
layout gives it.

`generate_image` refuses any prompt asking for photographic realism. A rendered
building is indistinguishable from a photographed one, which makes it the same
failure as a fabricated quote in a format nobody can audit. Illustrate the
article's idea instead: a title deed splitting into two paths, not a picture of
a tower.

## Renaming and deleting

`new_slug` and a category change both move the URL. Neither writes a redirect —
add it to `v2/public/_redirects` yourself, which is a git change.
