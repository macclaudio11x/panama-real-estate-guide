# Content plan — 2026-08-03

Supersedes the queue in `17-page-triage-2026-08-02.md`, which is now empty: all
23 Tier B pages were rewritten on 2026-08-02/03. This plan is built from a live
audit of Supabase on 2026-08-03, not from the triage spreadsheet.

Run the audit yourself before trusting any number here:

```bash
node v2/mcp/server.js
```

then call `content_audit`.

## Where the site actually stands

| | |
|---|---:|
| Published articles | **54** |
| …fully sourced and rewritten | 32 |
| …**still zero sources** | **22** |
| …under 1,200 words | 5 |
| …with a cover image | **0** |
| Areas | 16 |
| …with zero sources | 5 |
| Projects | 31 |
| …published, all with a price source | 13 |
| …unwritten drafts | 18 |

Two things changed today before this plan was written.

**Six articles were retired.** `panama-visa-rejected-what-to-do`,
`moving-to-panama-from-florida`, `panama-for-families-with-children`,
`what-to-pack-moving-to-panama`, `expat-depression-panama-unfiltered` and
`supermarkets-shopping-panama-expats` were all 301'd to a pillar in
`_redirects` but were still `status = published`. They were sitting in the
sitemap and on hub cards pointing at URLs that redirect away. Set to draft.

**`panama-property-tax-exemption-extended` was serving its retracted claim.**
The body was rewritten on 2026-08-03 to withdraw a fabricated 48–13 Assembly
vote, but `lib/content.ts` still carried the old title — *"National Assembly
extends 20-year property tax exemption for new construction"* — so every hub
card, nav card and sitemap entry kept publishing the false version. That class
of bug is now structurally impossible: the index reads Supabase.

## Do not order this by traffic

The cutover was 2026-07-31. Every GSC figure in docs 14–17 describes **v1**
URLs; the v2 URLs have three days of history. Ordering by impressions right now
orders by noise. The ordering below is by **method already proven on this
site**, which is the only real accelerator available.

---

## Phase 1 — the four stubs (this week)

Not thin: empty. Two of them are under 300 words behind a headline promising a
guide, which is the worst thing on the site right now.

| page | words | call |
|---|---:|---|
| `/residency/friendly-nations-2026` | 257 | **Redirect** to `/residency/panama-residency-guide`. The pillar already carries Friendly Nations sourced to Migración, including the B/.200,000 threshold and the "$500k in October" claim that is not in the law. |
| `/buying/pedasi-rising` | 258 | **Hold.** Needs the Pedasí *area* page, which does not exist. See Phase 4. |
| `/buying/avenida-balboa-panama-real-estate` | 443 | **Rewrite.** Real ground: this is a corridor, not a neighbourhood, and the tower-by-tower comparison it promises has no institutional source. Same honest-scarcity treatment the banking page got. |
| `/buying/colon-panama-real-estate` | 509 | **Rewrite.** Colón has genuinely sourceable material nobody uses: the Zona Libre, the ports, and SIEC's own provincial homicide rate of ~42 per 100k in 2025, already verified for the safety page. |

## Phase 2 — the proven formats (highest return)

Six pages where a rewrite method already exists, has been executed, and in one
case is the **only page on the site ranking for a real human query**
(`panama-vs-belize-retirement`, position 6.5). Narrow, specific,
low-competition comparisons are the shape that works here.

**Batch A — comparisons, dual-government sourcing.** Same method as the Belize
and Costa Rica rewrites: source *both* countries' own immigration regulations,
set their own crime statistics side by side in one chart, and state plainly
what neither government publishes.

| page | words | the sibling to copy |
|---|---:|---|
| `/living/panama-vs-colombia-retirement` | 2,794 | Colombia's Migración M-11 visa resolution |
| `/living/panama-vs-mexico-retirement` | 3,751 | INM's *residente temporal* income thresholds |
| `/living/panama-vs-portugal-retirement` | 4,861 | AIMA D7; note the NHR regime closed to new entrants in 2024 |
| `/living/panama-vs-spain-retirement` | 8,035 | Spain's non-lucrative visa; **the golden visa was abolished 3 April 2025** — the current page cannot possibly be right |

All four almost certainly carry invented case-study personas: that is what
Belize and Costa Rica both had, from the same generation batch.

**Batch B — origin-country moves, tax-treaty sourcing.** Same method as
`moving-to-panama-from-canada`, whose finding (25% CPP/OAS withholding because
Canada and Panama have an information-exchange agreement, not a treaty) is the
single most useful thing on that page.

| page | words | the question to answer |
|---|---:|---|
| `/living/moving-to-panama-from-uk` | 2,541 | UK state pension is **frozen** in Panama — no annual uprating, unlike EEA countries. Sourced to gov.uk. |
| `/living/moving-to-panama-from-texas` | 2,613 | The US **does** have a tax treaty position worth stating, plus Texas having no state income tax changes the comparison materially. |

## Phase 3 — consolidate rather than rewrite

Four unsourced pages duplicate a page that is already sourced. Rewriting them
creates two pages competing for one query.

| page | words | into |
|---|---:|---|
| `/living/how-to-rent-apartment-panama` | 2,045 | `/living/apartments-for-rent-panama-city` — same subject, and the target already carries Ley 93 de 1973 and the B/.150 exclusion decree |
| `/residency/panama-golden-visa-2026` | 2,834 | `/residency/panama-residency-guide` — the pillar has the real B/.300,000 Qualified Investor threshold |
| `/residency/panama-tax-benefits-foreigners-2026` | 3,033 | Split: territorial income → `/residency/start-business-panama-foreigners`; property tax → `/money/panama-property-tax-exemption-extended` |
| `/buying/condos-for-sale-panama-buyers-guide` | 2,525 | `/buying/panama-property-buying-process-guide` |

Each needs a 301 in `v2/public/_redirects` **and** `set_article_status draft`.
The redirect is a git change; the status is not.

## Phase 4 — the two area pages that unblock four articles

`pedasi-rising` and `santa-catalina-panama` are stranded: their natural
consolidation target is an area page, and neither **Pedasí** nor **Santa
Catalina** exists in `v2/data/airtable.json`. Creating those two area pages is
the only remaining unlock in the T3 list. Note the seam — a new area needs a
row in `airtable.json` (slug/name/region only; counts and prices recompute), a
Supabase `areas` row, and sources.

While there: five existing areas carry **zero sources** — `bijao`,
`buenaventura`, `costa-del-este`, `playa-venao`, `bocas-del-toro` — and four of
those five have no `positioning` either, so the page is a shell around a
project list. Costa del Este is the outlier and the priority: it is the single
most-searched expat address in Panama City and it has `suits`/`drawbacks` text
with nothing behind it.

## Phase 5 — the genuinely stranded

Do **not** force these into a pillar. That is the `/es/` soft-404 mistake that
`netlify.toml` already documents.

`/living/getting-around-panama-city-guide`, `/living/things-to-do-in-panama`,
`/living/panama-food-guide-expats`, `/living/why-expats-leave-panama-2-years`,
`/living/panama-drivers-license-foreigners`,
`/living/panama-for-digital-nomads-2026`, `/buying/coronado-real-estate-guide`.

Two of these have real sourced material waiting and should jump the queue:

- **Driver's licence** — the moving pillar already established that the 90-day
  foreign-licence period *is cited by nobody, including the law firms
  publishing it*, and that US/Canadian passports get 180 tourist days under
  Resolución 22068 de 2021. That contradiction is the page.
- **Digital nomads** — Panama has a real Remote Worker visa (Decreto Ejecutivo
  198 de 2021, short-stay, income threshold, explicitly bars local income). No
  competing page sources it to the decree.

## Images — 54 covers, zero exist

`og_image_path` existed as a column and was empty on every row, and nothing in
the app rendered it. Now the article page, the hub cards, the "Keep reading"
strip, the OG/Twitter tags and the Article JSON-LD all use it.

Generate through `generate_image`, which enforces the house style: flat
editorial illustration in the site palette, no text in the image, and a hard
refusal on any prompt asking for photographic realism. **Never a rendered
building.** A rendered tower is indistinguishable from a photographed one,
which makes it a fabricated source in a format nobody can audit — the same
failure as an invented testimonial.

Illustrate the *argument*, not the place:

| page | subject |
|---|---|
| `titled-vs-rights-of-possession` | one deed splitting into two diverging paths, one ending at a wall |
| `moving-to-panama-with-pets` | a calendar of forty marked days enclosing a house outline |
| `safety-in-panama-2026-real-data-rumors` | a map resolving from province blocks to district blocks, stopping before street level |
| `panama-cost-of-living-2026` | two nested rectangles, one a tenth the size of the other |

Order: the **32 sourced pages first** — those are the ones we want shared and
linked. The other 22 get theirs as part of their rewrite, so the image is drawn
from the finished argument rather than the fabricated one.

## Projects — 18 drafts

Lowest priority, highest unit cost. Each needs a hook, a drawback and 3+ FAQs
before the database will let it publish, and the drawback is the expensive part
because it has to be true and traceable. Sequence by area, not alphabetically:
Costa del Este has five drafts (`madero`, `nogal`, `aurum`, `tagua`,
`generation-tower`) and Santa María four, so one research pass on the area
serves several project pages.

Also open, mechanical rather than research-heavy: `amenities` is still Spanish
("Vista al Mar") throughout, synced from `data/airtable.json`.

## What this plan deliberately does not do

- **No new top-of-funnel content until the 22 are resolved.** Adding pages
  beside 22 unsourced ones dilutes the one thing this site sells.
- **No pillar hub pages** (`/buying-property-in-panama/` as a directory). This
  site uses the four categories. `06-pillar-cluster-map.csv`'s architecture was
  never adopted.
- **No traffic-based pruning** until v2 has ~90 days of its own GSC data,
  i.e. not before late October 2026.
