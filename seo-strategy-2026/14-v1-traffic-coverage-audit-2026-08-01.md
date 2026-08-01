# v1 traffic coverage audit, 2026-08-01

Does every v1 URL that earned search traffic now resolve to a v2 page that
actually covers the same intent? This is the post-cutover check on the redirect
map, run one day after the v1→v2 publish target moved.

## Method

GSC search analytics for the full 16-month window (2025-04-01 to 2026-08-01),
page dimension, 292 URLs. The 164 URLs under `/es/`, `/de/` and `/pt/` are
excluded: those trees were deliberately retired to 410 (see the block comment in
`netlify.toml`), and that decision is not what this audit is testing. That
leaves 128 English URLs carrying 52 clicks and 17,256 impressions.

Each of the 128 was resolved through the live redirect rules in `netlify.toml`
and `v2/public/_redirects`, applying Netlify's precedence order and Next.js's
308 trailing-slash normalisation, then the final destination was matched against
the v2 content inventory (`v2/lib/content.ts` articles, `v2/data/airtable.json`
areas and projects).

## Headline

**97.8% of English impressions land on a real, topically matched v2 page.**

| Disposition | URLs | clicks | impressions | % impr |
|---|---:|---:|---:|---:|
| Real v2 content | 94 | 47 | 16,869 | 97.8% |
| 410 Gone | 20 | 4 | 234 | 1.4% |
| Generic page (`/` or `/projects`) | 8 | 1 | 133 | 0.8% |
| No rule, 404 | 6 | 0 | 20 | 0.1% |

The 94 content-backed destinations are not thin ports. Spot-checked live, the
top eight by impressions return 200 and run 6,076 to 11,249 words with 11 to 42
`<h2>` sections.

## Gaps found

**1. Six extensionless `/videos/` URLs returned 404 rather than 410.** Fixed in
this commit. Google indexed both URL forms and only the `.html` form was mapped,
so `/videos/de_siaqflj0.html` returned 410 while `/videos/de_siaqflj0` returned
404. Same both-forms bug as the `/proyectos/` canonicals in f751734. Replaced
the 16 explicit slug rules with a `/videos/*` wildcard.

**2. Four `/news/` URLs still ranking at position 5.0 to 7.8 were 410'd.**
Investigated and closed, see "The `/news/` 410s, resolved" below. Keeping the
table because the surface reading is genuinely alarming and someone will raise
it again:

| URL | impr | clicks | avg pos |
|---|---:|---:|---:|
| `/news/buoy-hurricane-corridor.html` | 59 | 0 | 6.5 |
| `/news/tocumen-terminal-2-expansion.html` | 42 | 3 | 7.8 |
| `/news/copa-pedasi-route.html` | 33 | 0 | 6.8 |
| `/news/airport-tocumen-expansion.html` | 23 | 0 | 5.0 |

`tocumen-terminal-2-expansion` is a top-15 click earner across the whole
English site. The 410 treatment was applied to the `/news/` tree wholesale;
these four were not individually assessed against their own GSC rows.

**3. Spanish-language intent pointed at an English page.** Six v1 URLs written
in Spanish (`panama-para-colombianos-guia-2026`, `-argentinos`, `-brasileiros`,
`-ecuatorianos`, `-peruanos`, `vivir-en-panama-venezolanos`) all 301 to
`/living/retire-in-panama`, which is in English. Roughly 142 impressions of
Spanish-query intent now resolves to a language the searcher did not search in.
The destination is topically right and linguistically wrong.

## The finding that matters more than the gaps

The traffic this audit protects is negligible, and a large share of it is not
human. 52 clicks across 16 months on the entire English site.

The impression counts are misleading. `/articles/internet-providers-panama-expats.html`
shows 4,039 impressions at average position 8.1 and converted 3 clicks, a CTR of
0.07%. Position 8 should return 2 to 3%. Pulling that page's query breakdown
explains the gap: the impressions are hundreds of near-duplicate ultra-long-tail
strings at 1 to 8 impressions each, of the form

    asep panama internet providers fiber speeds panama city 2024
    asep panama internet providers fiber plans 2024
    cable onda +tigo panama fiber plans 2024 mbps prices

These read as machine-generated query patterns, not buyer searches. The same
shape appears on the pets page (`"panama" "pet birds" import permit quarantine`)
and across the site. Ranking well for them produces no clicks because nobody is
typing them.

### The split that matters

GSC withholds queries below an anonymisation threshold, which turns out to be a
usable proxy for "did a real person search this." Splitting the site's queries
on it is stark:

| | typical position |
|---|---|
| Named queries (real search demand) | **40 to 95** |
| Anonymised long-tail (synthetic shape) | **4 to 12** |

Real commercial queries and where the site actually sits on them:

| query | position |
|---|---:|
| `apartments for rent panama city` | 43.7 |
| `best beaches in panama` | 59 |
| `best cities to retire in panama` | 65.6 |
| `best cities in panama for expats` | 68.3 |
| `how to buy a house in panama` | 71.1 |
| `best areas to live in panama` | 72 |
| `best neighborhoods in panama city` | 72 |
| `best expat communities in panama` | 80 |

So the flattering average positions in the page table (7.6, 8.1, 7.9) are
averages dominated by the synthetic tail. On anything a buyer would actually
type, the site is on page 5 to 9. That is the real starting position, and it is
considerably worse than the page-level averages suggest.

One genuine exception, and it is the most useful signal in the dataset:
`belize vs panama retirement` sits at **position 6.5** with 8 impressions and
converted 3 of the site's 52 clicks. A narrow, specific, low-competition
comparison query is the only thing this site ranks for that a human types.

Also visible: `best neighborhoods in panama city fl` at position 72.3. Panama
City, Florida. Some share of impressions is wrong-geo and will never convert,
which `04-keyword-universe.csv` already flags as a disambiguation problem.

### The `/news/` 410s, resolved

Investigated per the open question above. Across the entire `/news/` tree only
10 query rows clear the anonymisation threshold, and **none of them belong to
the four URLs in question**. Every one of those 157 impressions came from
queries too rare to name, which is the same synthetic pattern. The named
`/news/` queries that do exist rank 42 to 86.

The wholesale 410 stands. No action.

So the redirect map is in good shape and is not what is holding the site back.
A content plan built around preserving v1's traffic would be optimising a
rounding error made mostly of synthetic queries. The plan needs to be keyed to
commercial intent the site does not yet rank for, with `04-keyword-universe.csv`
and `06-pillar-cluster-map.csv` as the starting point rather than this audit.

Also note that toxic backlinks gate all of this. See `00-seo-strategy.md`.

## Coverage of v2 pages with no v1 predecessor

Three v2 articles have no traffic-earning v1 URL redirecting into them, so they
start from zero index presence: `buying/avenida-balboa-panama-real-estate`,
`buying/titled-vs-rights-of-possession`, `residency/friendly-nations-2026`.
`titled-vs-rights-of-possession` is the site's central editorial claim and has
no inbound equity at all.
