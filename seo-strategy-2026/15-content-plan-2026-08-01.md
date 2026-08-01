# Content plan, post-cutover

Written 2026-08-01, one day after the v1→v2 cutover, off the evidence in
`14-v1-traffic-coverage-audit-2026-08-01.md`. Two sequenced phases: rescue the
pages that already hold index presence, then build the commercial cluster the
site has never ranked for.

## What the data says before anything else

Coverage is not the problem. 97.8% of English impressions already resolve to a
real, topically matched v2 page, and those pages run 6,000 to 11,000 words.

The problem is that on every query a human actually types, the site sits at
position 40 to 95. The page-level averages of 7 to 8 are an artefact of
synthetic long-tail queries. Full working in doc 14.

One page ranks for a real query: `/living/panama-vs-belize-retirement` at
position 6.5 for `belize vs panama retirement`, which converted 3 of the site's
52 clicks. Narrow, specific, low competition. That is the shape that works here,
and Phase 1 and Phase 2 both lean on it.

Standing constraint: the toxic backlink profile gates all of this. See
`00-seo-strategy.md`. Content work compounds only after that is resolved, so
none of the below should be read as expecting fast movement.

## Phase 1 — Rescue

Six pages that already carry index presence and deep content but rank 40 to 95
on their real commercial queries. These need re-aiming, not rewriting. The
content exists; it is not matching the query.

Ordered by evidence strength, not impression count.

**1. `/buying/best-neighborhoods-panama-city-expats`** — 857 impressions across
two merged v1 URLs. Real queries at position 62 to 94: `best areas to live in
panama`, `best cities in panama for expats`, `best neighborhoods in panama
city`, `best expat communities in panama`. Note the query set is broader than
the page: people are asking about *Panama*, the page answers about *Panama
City*. Also fielding `best neighborhoods in panama city fl` at 72.3, which is
the Florida disambiguation problem. Fix the scope mismatch and the geo signal.

**2. `/buying/panama-retirement-communities`** — 1,637 impressions, the largest
pool on the site. Real queries at 65 to 77: `best cities to retire in panama`,
`best city to retire in panama`, `best cities in panama to retire`. Same
mismatch shape: the queries are about *places*, the page is about *communities*.
`06-pillar-cluster-map.csv` already flags this one as P0 with CPC $2.15 and
prescribes visiting and photographing each community with real monthly fees.
That first-hand requirement is what would separate it from the incumbents.

**3. `/living/best-beaches-panama-expats`** — 204 impressions, 3 clicks, and the
widest spread of real queries on the site: nine named variants of `best beaches
panama`, all at position 50 to 65. High real demand, uniformly page 5 to 7. The
page is also the thinnest of the rescue set in editorial terms (its dek is a
duplicate of its title, which is a marker of the weaker ported pages).

**4. `/buying/panama-property-buying-process-guide`** — 497 impressions across
two merged v1 URLs. `how to buy a house in panama` at 71.1, which converted 1
click. This is the money query for the whole site and it is on page 8.

**5. `/living/apartments-for-rent-panama-city`** — 267 impressions. `apartments
for rent panama city` at 43.7, the best real-query position in the rescue set,
so the shortest distance to page 1. Six named rental queries all clustered.

**6. `/living/retire-in-panama`** — position 50.8, and it absorbs eight v1 URLs
including six Spanish-language ones. Doing this page properly means resolving
the Spanish problem below first, otherwise it is being asked to serve two
languages at once.

**Deliberately not in Phase 1:** `internet-providers-panama-expats`,
`moving-to-panama-with-pets`, `panama-sim-card-guide`,
`sending-money-panama-wire-transfer`. These carry the biggest impression counts
on the site and almost all of it is synthetic. They are already deep, they have
no named commercial queries, and effort there returns nothing.

## Phase 1b — Spanish landing page

Six Spanish-language v1 URLs (`panama-para-colombianos-guia-2026`,
`-argentinos`, `-brasileiros`, `-ecuatorianos`, `-peruanos`,
`vivir-en-panama-venezolanos`, ~142 impressions) currently 301 to
`/living/retire-in-panama`, which is in English.

Scope one Spanish page as a real destination, then repoint the six. Open
decisions before it can be briefed:

- **Route.** v2 has no locale segment and the `/es/` tree was deliberately 410'd
  as machine-translated. A hand-written Spanish page is a different proposition
  from that, but it needs a URL that does not read as a revival of the retired
  tree.
- **Scope.** The six source URLs are per-nationality (Colombian, Argentine,
  Brazilian, Ecuadorian, Peruvian, Venezuelan buyers). One consolidated page, or
  the two with the most signal? Note `-brasileiros` is Portuguese, not Spanish.
- **hreflang.** Whatever ships needs annotation, and the cutover explicitly
  stripped hreflang from the English pages when the locale trees died.

Not brief-ready until those three are settled.

## Phase 2 — The commercial cluster

`04-keyword-universe.csv` and `06-pillar-cluster-map.csv` already specify this
work in detail. Phase 2 is executing the Wave 1 P0 set, not re-planning it.

The head term is `panama real estate` at 3,600 US volume, KD 31, currently not
ranking. The map's Wave 1 P0 pillar and its cluster:

| page | primary keyword | KD |
|---|---|---:|
| Buying Property in Panama pillar | `panama real estate` | 31 |
| Buying process, step by step | `panama property buying process` | — |
| What it costs to close | `panama closing costs` | — |
| Can foreigners buy property | `can a foreigner buy real estate in panama` | — |
| Titled land vs Rights of Possession | `titled land vs rights of possession panama` | — |
| Best places to retire, compared | `best places to retire in panama` | — |

Cheap wins worth pulling forward, all flagged in the keyword universe:
`homes for sale in the republic of panama` (KD 0, 320 vol), `real estate in
panama central america` (KD 15, 590 vol, and it disambiguates from Panama City
FL), `homes for sale panama` (KD 18, 590 vol), `panamanian real estate for sale`
(KD 21, 590 vol).

### Resolved: the pillar map now uses v2's flat URL scheme

`06-pillar-cluster-map.csv` was written pre-cutover and prescribes nested
pillars: `/buying-property-in-panama/`, `/buying-property-in-panama/process/`,
`/retire-in-panama/best-places/`, and so on. v2 shipped a flat two-level scheme,
`/[category]/[slug]`, with categories fixed at buying, residency, money, living.

These were incompatible. Decision taken 2026-08-01: **adopt v2's flat scheme.**
The hierarchy signal the map wanted from URL nesting comes instead from internal
linking and breadcrumbs, both of which the v2 templates already emit, and moving
these URLs twice inside a month is worse for the little index presence there is.
The alternative, adding nested pillar routes to v2, would have meant a routing
change plus a second set of redirects on pages that moved one day ago.

All 36 `Suggested_URL` values in `06-pillar-cluster-map.csv` are rewritten to
v2-flat. Three consequences worth knowing before briefing anything:

**The map was more out of date than the URLs.** Its `Disposition` column still
referenced eleven `/articles/*.html` URLs that no longer exist, and it marked
four pages "Create" that are already live in v2, which reads as a licence to
publish a duplicate. Both repointed. It also said "all 13 [project pages] are
thin"; there are 31.

**Some pages had to change category.** v2's categories are fixed at buying,
residency, money, living. Property tax and mortgage financing moved from buying
to money. `best-neighborhoods-panama-city-expats` sits under buying, not living,
which is where the map filed it.

**No `/tools/`, `/research/` or `/compare/` route exists in v2.** The two tools
rows are now merged into the guides they belong to: the closing-cost calculator
embeds in `/buying/panama-closing-costs`, the residency quiz in
`/residency/panama-residency-guide`. If either is wanted as a standalone
destination, that is a routing decision, not a content one.

**Three area pages are blocked, all P0.** `/areas/panama-city`,
`/areas/coronado` and `/areas/pedasi` have no row in `data/airtable.json`, and
areas are sync-driven from Airtable rather than authored in the repo. Coronado
is the sharpest case: the map wants an area page, and the live content is an
article at `/buying/coronado-real-estate-guide`. Someone has to add these areas
upstream in Airtable, or the map has to accept articles instead of area pages.

## What is deliberately not here

- Reversing the `/news/` 410s. Investigated and closed in doc 14.
- Anything keyed to preserving v1 traffic. It is 52 clicks over 16 months and
  the coverage work is done.
- New project or area pages. `titled-vs-rights-of-possession` is the site's
  central editorial claim and has no inbound equity at all, but it is a Phase 2
  cluster page, not a standalone.
