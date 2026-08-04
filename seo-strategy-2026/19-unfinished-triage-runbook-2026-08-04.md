# The unfinished triage — runbook, 2026-08-04

**Read this first if you were told the content rewrite was finished. It was not.**

Doc 17 sorted the site into three tiers: **T1 rewrite (32)**, **T2 keep-but-revisit
(10)**, **T3 redirect (14)**. The "queue complete" note in
`panama-tier-b-rewrite-runbook` refers to the last 23 pages of **T1 only**. T2 was
parked by design. T3's redirects were blocked because their destinations were
pillars that did not exist yet — the pillars were built, and nobody went back and
executed the redirects.

So the rewrite queue finished and the triage never did. Twenty-two published pages
still carry zero sources. Everything below is verified live against Supabase and
production on 2026-08-04, not inherited from a spreadsheet.

## Verified state

| | |
|---|---:|
| Published articles | 54 |
| Sourced, rewritten, with a cover image | 32 |
| **Zero sources** | **22** |
| Rendering **two** "Frequently asked questions" sections | **12** |
| Body carries an FAQ heading but `faqs` is empty | 7 |
| Inbound redirect rules landing on one of the 22 | **27** |

Re-derive any of this yourself rather than trusting it — see *Verify* at the end.

## Two things that need fixing today, before any rewriting

### 1. A fabricated first-person survey is live

`/living/why-expats-leave-panama-2-years` publishes:

> "Our Panama Real Estate Guide survey (n=340, conducted 2024-2025) tracked expat
> satisfaction markers: 78% reported high satisfaction in month 6; 61% in month 12…"

We never ran a survey. This is the fabricated-evidence pattern again, and worse
than the VIP Expats case because the authority it invents is **us**. Derived
claims run through the page ("monolingual expats staying 2+ years: 18%").

It is also a redirect destination: `/living/expat-depression-panama-unfiltered`
and `/articles/expat-depression-panama-unfiltered.html` both land on it.

A sweep of all 54 published pages for first-person research claims found exactly
one other hit, and it is innocent — `/money/atm-cash-panama-guide` says "that is
not an oversight in our research," which is a turn of phrase, not a dataset.

### 2. Twelve pages render the FAQ section twice

The body carries its own `## FAQs` heading and the template appends another from
the `faqs` field. Four FAQ headings render on the live page.

**Two of these are in the "rewritten, sourced and independently verified" 32** —
`boquete-panama-real-estate` and `bocas-del-toro-real-estate`. The verification
pass that cleared them did not check this.

| page | sources | faqs |
|---|---:|---:|
| `/buying/bocas-del-toro-real-estate` | 6 | 6 |
| `/buying/boquete-panama-real-estate` | 5 | 6 |
| `/buying/coronado-real-estate-guide` | 0 | 5 |
| `/living/moving-to-panama-from-texas` | 0 | 6 |
| `/living/moving-to-panama-from-uk` | 0 | 6 |
| `/living/panama-drivers-license-foreigners` | 0 | 8 |
| `/living/panama-food-guide-expats` | 0 | 6 |
| `/living/panama-for-digital-nomads-2026` | 0 | 7 |
| `/living/panama-vs-colombia-retirement` | 0 | 10 |
| `/living/panama-vs-mexico-retirement` | 0 | 5 |
| `/living/panama-vs-spain-retirement` | 0 | 7 |
| `/living/why-expats-leave-panama-2-years` | 0 | 9 |

`lint_article` catches this in one call. It did not exist when these were written.

A further 7 pages carry an FAQ heading in the body with `faqs` empty — single
render, wrong shape, fix when each is rewritten: `things-to-do-in-panama`,
`getting-around-panama-city-guide`, `condos-for-sale-panama-buyers-guide`,
`panama-tax-benefits-foreigners-2026`, `how-to-rent-apartment-panama`,
`panama-golden-visa-2026`, `santa-catalina-panama`.

## Disposition of all 22

### A · Consolidate — 5

Each is fully covered by a page that is already sourced. Redirect and unpublish.

| page | → destination |
|---|---|
| `/residency/friendly-nations-2026` (257w) | `/residency/panama-residency-guide` |
| `/residency/panama-golden-visa-2026` | `/residency/panama-residency-guide` |
| `/residency/panama-tax-benefits-foreigners-2026` | `/residency/start-business-panama-foreigners` |
| `/living/how-to-rent-apartment-panama` | `/living/apartments-for-rent-panama-city` |
| `/buying/condos-for-sale-panama-buyers-guide` | `/buying/panama-property-buying-process-guide` |

### B · Keep and rewrite — 11

Ordered by how much of the method already exists.

| page | inherits the method from |
|---|---|
| `/living/panama-vs-colombia-retirement` | the Belize and Costa Rica rewrites — source *both* governments |
| `/living/panama-vs-mexico-retirement` | same |
| `/living/panama-vs-portugal-retirement` | same |
| `/living/panama-vs-spain-retirement` (8,035w) | same. Spain abolished the golden visa on 3 Apr 2025, so the current page cannot be right |
| `/living/moving-to-panama-from-uk` | the Canada rewrite. UK state pension is **frozen** in Panama, no annual uprating |
| `/living/moving-to-panama-from-texas` | the Canada rewrite |
| `/living/panama-drivers-license-foreigners` | the moving pillar already found the 90-day licence claim has no citation anywhere, and US/Canadian passports get 180 tourist days under Resolución 22068 de 2021 |
| `/living/panama-for-digital-nomads-2026` | Decreto Ejecutivo 198 de 2021 creates a real Remote Worker visa nobody sources |
| `/living/getting-around-panama-city-guide` | Metro de Panamá publishes the fare and line data. **Sourceable — this was wrongly filed as stranded in doc 18** |
| `/buying/avenida-balboa-panama-real-estate` (443w) | honest-scarcity treatment, as used on the banking page |
| `/buying/colon-panama-real-estate` (509w) | SIEC's provincial homicide rate for Colón is already verified for the safety page |

`/buying/coronado-real-estate-guide` also belongs here — no area page exists for
the Coronado corridor, so it cannot be consolidated.

### C · Blocked on an area page — 2

`/buying/pedasi-rising` and `/buying/santa-catalina-panama`. Neither Pedasí nor
Santa Catalina exists in `v2/data/airtable.json`, so there is nothing to
consolidate into. Creating those two area pages is the only unlock. A new area
needs a row in `airtable.json` (slug/name/region only — counts and prices
recompute) plus a Supabase `areas` row with real sources.

### D · Needs a decision from Charles — 3

No pillar covers them, and forcing them into a loosely-related page is the
soft-404 mistake `netlify.toml` already documents from the `/es/` decision.

| page | words | the problem |
|---|---:|---|
| `/living/why-expats-leave-panama-2-years` | 2,853 | fabricated survey, see above. **Cannot stay as-is regardless of the decision** |
| `/living/things-to-do-in-panama` | 4,213 | 109 unsourced dollar figures. Tourism content on a property site |
| `/living/panama-food-guide-expats` | 2,739 | 195 unsourced dollar figures. Partly rescuable — the MEF *canasta básica* is already sourced on the cost-of-living pillar |

Both `things-to-do` and `food-guide` are redirect destinations, so removing them
means repointing inbound rules too.

## The redirect trap

**27 inbound rules currently land on one of the 22.** Unpublishing any of them
without repointing its rules turns a working 301 into a 404.

Two are worse than the rest, because a page was consolidated *into* a page that is
itself unsourced:

```
/living/expat-depression-panama-unfiltered   ->  /living/why-expats-leave-panama-2-years
/living/supermarkets-shopping-panama-expats  ->  /living/panama-food-guide-expats
```

**Order of operations, per page. Getting this backwards 404s a live URL:**

1. add the new `/category/slug  /category/destination  301!` rule to
   `v2/public/_redirects`
2. repoint every existing rule that lands on the page being retired
3. commit and push — `_redirects` is a build artifact, it only takes effect on deploy
4. **wait for the deploy**, then `set_article_status draft` via the MCP

Step 4 last. The redirect fires before the page renders, so once it is live the
unpublish is harmless; do it first and the URL 404s in the gap.

## Order of work

1. **Fix the 12 double-FAQ bodies.** Mechanical, no research, no decisions. Strip
   the FAQ heading and everything below it from `body`; the `faqs` field already
   holds the content. Do this first because two of the twelve are otherwise-clean
   pages and it takes the live defect count down immediately.
2. **Resolve `why-expats-leave-panama-2-years`.** Fabricated survey. If Charles has
   not decided its fate, unpublish it and repoint its two inbound rules at
   `/living/living-in-panama` as a holding position.
3. **Execute A**, all 5, following the redirect ordering above.
4. **Rewrite B**, top of the table down. Use the `panama-writer` skill; publish
   through the MCP, which enforces the source gate.
5. **C and D** once Charles rules.

## Commands

The MCP server is registered as `panama` in the repo's `.mcp.json`. From a fresh
checkout:

```bash
cd v2/mcp && npm install
```

`v2/.env.local` already holds the Supabase service key, the R2 keys and
`GEMINI_API_KEY`. It is gitignored and persists on disk — read it, do not ask for
credentials.

Tools you will use: `content_audit`, `list_articles`, `get_article`,
`lint_article`, `update_article`, `set_article_status`, `generate_image`.

**Content edits go live in ~60 seconds with no deploy** — the article index reads
from Supabase and every content route revalidates at 60s. `_redirects` and
anything under `v2/app`, `v2/lib`, `v2/components` still need a push. Deploys are
**30–41 seconds**, not the 45 minutes an older note claims.

Cover images: 32 of 54 have one. The remaining 22 get theirs as part of their
rewrite. House style is documentary photography modelled on leyconsulta.com,
enforced in `v2/mcp/lib.js` — scene-driven, positive, never a named place or
development.

**Do not push.** Charles pushes. Commit locally and stop.

## Verify

Re-derive the numbers rather than trusting this document:

```bash
cd v2/mcp && node -e "
import('./lib.js').then(async ({db}) => {
  const { data } = await db().from('articles')
    .select('slug,body,sources,faqs,og_image_path').eq('status','published');
  const dbl = data.filter(a => (a.faqs||[]).length && /^##+\s*(faqs?|frequently)/im.test(a.body||''));
  console.log('published        :', data.length);
  console.log('zero sources     :', data.filter(a => !(a.sources||[]).length).length);
  console.log('double FAQ       :', dbl.length);
  console.log('no cover image   :', data.filter(a => !a.og_image_path).length);
})"
```

Expected today: 54 / 22 / 12 / 22. Any number that has moved means someone has
started; find out what before continuing.

Related: `18-content-plan-2026-08-03.md` (the rewrite ordering and the image
brief) · `17-page-triage-2026-08-02.md` (the original tiering) ·
`16-content-integrity-audit-2026-08-01.md` (the fabrication classes).
