# Localisation: the plan

Drafted 2026-08-10 as a Spanish plan. **Rescoped 2026-08-13: German ships
first, Spanish stays queued behind it.** Nothing here is built yet.

The architecture in §2 through §4 and §8 through §9 is locale-agnostic and
serves both. §5 through §7 are the German content scope. Spanish keeps its
settled decisions in §12 and picks them up unchanged when its turn comes.

**Why the order changed.** German is the only locale where we can measure
demand instead of inferring it, because v1 already ran the experiment and the
results are still in Search Console. See §1a.

## 1. Where we stand

**Content surface today, all English:**

| Type | Count | Route |
|---|---|---|
| Articles | 49 published | `/{category}/{slug}` |
| Areas | 23 | `/areas/{slug}` |
| Projects | 39 published (45 rows) | `/projects/{slug}` |
| Category hubs | 4 | `/{category}` |
| Index + static | 5 | `/`, `/areas`, `/projects`, `/about`, `/contact` |
| **Total** | **~120 URLs** | |

**Technically we have nothing.** `app/layout.tsx` hardcodes `lang="en"`. No
`alternates.languages` on any route. `app/sitemap.ts` emits one URL per page
with no alternates. `app/robots.ts` points at one sitemap. There is no locale
concept anywhere in `lib/`.

**The demand is real and already visible in Search Console.** Last 90 days:

- Panama is the number two country by clicks (25 clicks, 2,398 impressions,
  avg position 14.2). Second only to the USA.
- Colombia, Spain and Costa Rica all appear with clicks.
- Spanish queries are already surfacing English pages, badly: `bancos en panama
  para extranjeros no residentes` at position 67, `abrir empresa en panama como
  extranjero` at position 78. Google understands the topic match and the
  language mismatch is capping us.
- Germany is number three by clicks (17), with `auswandern nach panama` queries.
  ~~Out of scope, but see §11.~~ **Superseded 2026-08-13: German is now Phase 1.
  See §1a.**

**v1 already tried this and threw it away.** `public/_redirects` still carries
ten Spanish and Portuguese landing pages from the old site, every one of them
301'd into a single English article:

```
/articles/panama-para-colombianos-guia-2026.html   -> /living/retire-in-panama
/articles/panama-para-mexicanos-guia-2026.html     -> /living/retire-in-panama
/articles/espanoles-panama-alternativa-golden-visa-2026.html -> /living/retire-in-panama
```

Seven more like it. That tells us two things: the audience hypothesis is not
new, and whatever equity those URLs had is now pointed at an English page that
cannot serve the query.

**One caveat before any of this.** The toxic backlink profile
(`panama-toxic-backlink-profile`) gates ranking in every language. Translated
content is additive. It does not route around a link-profile handicap.

---

## 1a. The German case, and the 410 that is currently eating it

Added 2026-08-13, after a traffic review.

### The evidence that moved German to Phase 1

Search Console, 28 days to 2026-08-13, by country:

| Market | Clicks | Impressions | CTR |
|---|---|---|---|
| USA | 22 | 10,537 | 0.21% |
| Panama | 15 | 1,620 | 0.93% |
| **Germany** | **12** | **723** | **1.66%** |
| Canada | 10 | 433 | 2.31% |
| Austria + Switzerland | 6 | 162 | ~3.7% |
| Spain | 1 | 150 | 0.67% |
| Colombia | 1 | 132 | 0.76% |

DACH is 18 clicks against the USA's 22, on 8% of the impressions. Germany
converts impressions to clicks roughly eight times better than the US does.
Spain and Colombia, the markets the Spanish plan was written for, are at one
click each.

That is not an argument that German is a bigger market than Spanish. It is an
argument that **German is the one locale where we already have measured
demand rather than a hypothesis**, because v1 shipped machine-translated German
pages and Google is still ranking them.

### The 410 was decided on evidence that has since gone stale

`netlify.toml` justifies retiring the locale trees with: *"These 405 URLs earned
30 clicks in 119 days combined."* That was true when written.

The `/de/` tree alone has now earned **26 clicks in the last 90 days**, and
nearly all of it is recent: `/de/articles/retire-in-panama.html` has 7 clicks
over 90 days and 7 over 28 days. Every German click the site has ever recorded
on that page arrived in the last month.

The 410 shipped 2026-07-31 (`70e277f`). **The German traffic grew during the
410 window.** Those URLs are still indexed, still ranking, and still being
clicked, and every one of those clicks currently lands on `/410.html`. This is
active bleeding, not a historical loss, which is what makes it worth fixing now
rather than after the Spanish build.

### What the 410 got right, and still gets right

Nothing here argues for restoring machine-translated pages. The original
reasoning holds on all three of its other points:

- Zero referring domains on the deep locale URLs, so no page-level link equity
  was at stake.
- The MT pages cannibalised their English originals, the `/de/` page outranking
  the EN one for an English query. A properly hreflang'd German tree fixes that
  by declaring the pair, which is exactly what the MT tree never did.
- 410 over 404 was the right call for pages we genuinely intended to withdraw.

The correction is narrow: **for the ~20 German URLs with measurable demand, we
withdrew a ranking asset instead of replacing it.** Everything else in the 405
stays 410.

### The recovery mechanism, which is the point of the whole exercise

The traffic lives on old v1 URLs of the shape
`/de/articles/{slug}.html`. Building a German tree at `/de/leben/{slug}` does
not capture it. The old URL still 410s and the ranking is lost.

So the German build carries a step the Spanish build does not need: **per-URL
301s from each old `/de/articles/*.html` to its new German counterpart**,
replacing the wildcard 410 for exactly those slugs.

`netlify.toml` explicitly rejected redirecting these URLs, on the grounds that
*"the content differs, and bulk redirects to loosely-related pages are treated
as soft 404s."* That objection was about redirecting **German pages to English
ones**, and it was correct. It does not apply to a German page redirecting to
its true German counterpart. The soft-404 risk comes from relevance mismatch,
and there is none here.

Rules are order-sensitive in `netlify.toml`. The per-URL 301s must sit **above**
the `/de/*` wildcard, which stays in place to catch the ~385 URLs we are not
reviving.

### The German URL inventory, and what each one maps onto

Search Console, `/de/` pages, 90 days to 2026-08-13, ranked by clicks then
impressions. The right-hand column is the live English page whose German
counterpart the old URL would 301 to.

| Old German URL (`/de/articles/…`) | Clicks | Impr | Pos | English counterpart |
|---|---|---|---|---|
| `retire-in-panama.html` | 7 | 276 | 23.6 | `/living/retire-in-panama` |
| `10-best-places-to-live-in-panama-2026.html` | 6 | 113 | 5.0 | ⚠ none exact, see below |
| `best-neighborhoods-panama-city-expats.html` | 2 | 98 | 7.5 | `/buying/best-neighborhoods-panama-city-expats` |
| `panama-real-estate-market-2026.html` | 2 | 33 | 5.4 | `/buying/panama-real-estate-market-2026` |
| `panama-vs-colombia-retirement.html` | 2 | 3 | 2.0 | `/living/panama-vs-colombia-retirement` |
| `best-beaches-panama-expats.html` | 1 | 637 | 58.5 | `/living/best-beaches-panama-expats` |
| `panama-drivers-license-foreigners.html` | 1 | 55 | 7.7 | `/living/panama-drivers-license-foreigners` |
| `atm-cash-panama-guide.html` | 1 | 50 | 8.0 | `/money/atm-cash-panama-guide` |
| `supermarkets-shopping-panama-expats.html` | 1 | 48 | 8.5 | ⚠ EN is **draft** |
| `moving-to-panama-with-pets.html` | 1 | 37 | 6.6 | `/living/moving-to-panama-with-pets` |
| `panama-healthcare-costs-2026.html` | 1 | 17 | 8.2 | `/living/panama-healthcare-costs-2026` |
| `start-business-panama-foreigners.html` | 1 | 4 | 14.0 | `/residency/start-business-panama-foreigners` |
| `bocas-del-toro-real-estate.html` | 1 | 2 | 5.0 | `/buying/bocas-del-toro-real-estate` |
| `/de/articles/` (index) | 0 | 70 | 57.6 | `/de/` hub. Query: `plan b panama` |
| `panama-vs-costa-rica-retirement.html` | 0 | 57 | 22.1 | `/living/panama-vs-costa-rica-retirement` |
| `sending-money-panama-wire-transfer.html` | 0 | 53 | 26.1 | `/money/sending-money-panama-wire-transfer` |
| `panama-cost-of-living-2026.html` | 0 | 47 | 29.9 | `/money/panama-cost-of-living-2026` |
| `panama-weather-guide.html` | 0 | 46 | 22.3 | ⚠ none exact, consolidated |
| `getting-around-panama-city-guide.html` | 0 | 42 | 13.3 | `/living/getting-around-panama-city-guide` |
| `how-to-buy-property-in-panama-2026-guide.html` | 0 | 42 | 15.8 | ⚠ none exact, consolidated |
| `internet-providers-panama-expats.html` | 0 | 26 | 15.0 | `/living/internet-providers-panama-expats` |
| `panama-banking-non-residents-guide.html` | 0 | 16 | 9.2 | `/money/panama-banking-non-residents-guide` |
| `safety-in-panama-2026-real-data-rumors.html` | 0 | 14 | 7.7 | `/living/safety-in-panama-2026-real-data-rumors` |
| `panama-golden-visa-2026.html` | 0 | 11 | 20.8 | ⚠ EN is **draft** |

Whole tree: 26 clicks, roughly 1,900 impressions, 90 days.

**Five rows need a decision rather than a mapping:**

1. `10-best-places-to-live-in-panama-2026` is the second-biggest German earner
   at position 5.0, and v2 consolidated it into
   `/living/best-places-to-retire-in-panama`. Those are close but not the same
   article: "best places to live" is not "best places to retire". Redirecting
   is defensible; writing the German page against the retire slug and accepting
   a slightly different target is also defensible. **Recommend** mapping it to
   the retire page and watching the position after recrawl, because the German
   query set behind it (`wo in panama leben`, `beste orte panama`) is served by
   that page's content either way.
2. `panama-weather-guide` and `how-to-buy-property-in-panama-2026-guide` were
   both consolidated in v2. Map to
   `/living/panama-weather-rainy-season-guide` and
   `/buying/panama-property-buying-process-guide` respectively. Both are true
   supersets of the v1 article, so this is a legitimate 301 rather than a
   loose one.
3. `supermarkets-shopping-panama-expats` and `panama-golden-visa-2026` are
   **draft in English**. A German page cannot be the translation of an
   unpublished source under the model in §3. Either publish the English page
   first or leave those two on the 410. **Recommend** leaving them; between
   them they account for 1 click.

### The strategic tension, stated plainly

**The German demand is not on the money pages.** It is on relocation and
lifestyle: retire, best places, neighbourhoods, beaches, healthcare, driving
licence, supermarkets. The buying pillar has almost no German traffic, and
`titled-vs-rights-of-possession`, the central claim of the entire site, does
not appear in the German data at all.

So the German tree captures top-of-funnel readers, not buyers ready to
transact. Two things make that acceptable rather than fatal:

- The funnel was always designed to run retire → area → project, not to land a
  buyer on a title-law explainer cold.
- The one genuine inbound lead the site has ever produced (`PRG-2026-652125`,
  2026-08-12) came from `/living/safety-in-panama-2026-real-data-rumors`, a
  lifestyle guide, via organic search. Top-of-funnel converting is not
  theoretical here, it is the only conversion we have.

What it does mean: **do not judge Phase 1 on German lead volume in the first
quarter.** The measurable Phase 1 outcome is recovered rankings and recovered
clicks on URLs we already own. Leads are a Phase 2 question.

---

## 2. URL architecture

**Decision: locale subdirectories on the same domain. `/de/` first, `/es/`
later.**

Rejected alternatives:

- `de.panamarealestateguide.com` splits domain authority in two. We do not have
  enough to split, particularly with the backlink profile as it is.
- A ccTLD (`.de`, `.com.pa`) hard-signals one country. The German audience is
  Germany plus Austria and Switzerland, which already contribute a third of DACH
  clicks, and a ccTLD tells Google to suppress the other two.

**`/de/` is additionally forced by §1a**: the URLs we are recovering already sit
under `/de/`. Any other prefix forfeits the 301 path and the rankings with it.

### How it maps in the App Router

The site's dynamic segment `[category]` sits at the root, so a root-level
`[lang]` param would collide with it and every English URL would have to be
rewritten through middleware. That is a needless risk to pages that already
rank.

Instead: a **literal locale segment** mirroring the tree. Next matches static
segments before dynamic ones, so `/de/kaufen` resolves to the German route and
never falls into `[category]`. No middleware. Every existing English URL is
byte-for-byte unchanged.

```
app/
  (site)/                      <- unchanged, English
    [category]/[slug]/page.tsx
    areas/[slug]/page.tsx
    projects/[slug]/page.tsx
    ...
  (de)/de/                     <- Phase 1
    [kategorie]/[slug]/page.tsx
    regionen/[slug]/page.tsx
    projekte/[slug]/page.tsx
    kontakt/page.tsx
    so-arbeiten-wir/page.tsx
    not-found.tsx
  (es)/es/                     <- queued, same shape
    ...
```

Build `(de)` so that `(es)` is a copy with a different slug map, not a second
implementation. If adding the second locale means touching anything outside the
route files and the maps in `lib/i18n.ts`, the first one was built wrong.

The new route files are thin. They resolve the locale, call the same data
functions with `locale: "es"`, and render the same components. Page logic is
not duplicated.

### The `<html lang>` problem

`<html>` lives in the root layout, and a server layout cannot read the current
pathname. The correct fix is **one root layout per route group**: delete
`app/layout.tsx`, and give `(site)`, `(de)`, later `(es)`, and `admin` each
their own `<html>`. Fonts, `metadataBase` and the Typekit link move into a
shared `<DocumentShell lang>` component so there is still one place to edit
them.

Cost: one file restructured, and a full page load when a user switches
language. That is acceptable for a language switch and nobody will notice it.

### Slug map

Category slugs translate. Area and project slugs are proper nouns and do not.

| English | German (Phase 1) | Spanish (queued) |
|---|---|---|
| `/buying` | `/de/kaufen` | `/es/comprar` |
| `/residency` | `/de/aufenthalt` | `/es/residencia` |
| `/money` | `/de/finanzen` | `/es/dinero` |
| `/living` | `/de/leben` | `/es/vivir` |
| `/areas` | `/de/regionen` | `/es/zonas` |
| `/projects` | `/de/projekte` | `/es/proyectos` |
| `/about` | `/de/so-arbeiten-wir` | `/es/como-trabajamos` |
| `/contact` | `/de/kontakt` | `/es/contacto` |
| `/areas/costa-del-este` | `/de/regionen/costa-del-este` | `/es/zonas/costa-del-este` |
| `/projects/bioma-costa-del-este` | `/de/projekte/bioma-costa-del-este` | `/es/proyectos/bioma-costa-del-este` |

**No umlauts or ß in any slug.** Transliterate: `ue`, `oe`, `ae`, `ss`.
Percent-encoded slugs are legal and every one of them is a support problem the
first time somebody pastes one into WhatsApp.

`finanzen` over `geld` is a register call, matching the `Sie` decision in §6.
Category slugs almost never rank on their own, so the search cost is close to
zero and the tone cost of `geld` is not.

Article slugs are written fresh in the target language, not transliterated.
Stored per translation row, so nothing is derived at runtime. This is what lets
§1a's 301 map point at a real German slug rather than a mangled English one.

---

## 3. Data model

Two migrations, both handoffs to Charles for the SQL editor. There is no DDL
path from this machine (`panama-seo-metadata-rules`).

**Numbering: 0013 and 0014**, corrected 2026-08-13. ~~0011 and 0012.~~ The
warning in the 2026-08-10 draft was justified: the CRM work landed
`0011_crm_objects.sql` and `0012_email_and_sequences.sql` in the days after,
both still uncommitted, taking those numbers out from under this section for the
second time.

**Re-check `ls v2/supabase/migrations/` immediately before writing these files.**
The CRM workstream is active and this has now happened twice.

### 0013: `article_translations`

```
article_id       uuid not null references articles(id) on delete cascade
lang             text not null                  -- 'es'
slug             text not null
title            text not null
dek              text
seo_title        text
meta_description text
body             text
faqs             jsonb not null default '[]'
status           publish_status not null default 'draft'
translator_id    uuid references authors(id)
reviewer_id      uuid references authors(id)    -- PUBLIC accuracy badge. Renders.
reviewed_on      date
checked_by       uuid references authors(id)    -- INTERNAL language check. Never renders.
checked_on       date
updated_on       date
published_at     timestamptz
source_updated_on date                          -- see below
unique (lang, slug)
check (status <> 'published' or (checked_by is not null and checked_on is not null))
check (checked_by is null or checked_by <> translator_id)
```

**`checked_by` and `reviewer_id` are two different jobs and must not be
merged.** `reviewer_id` is the credentialled professional whose signature
renders on the page with an avatar and a licence string, and it is an E-E-A-T
claim to the reader. `checked_by` is whoever read the German against the English
and confirmed it says the same thing. It never renders. A translation can be
correct without carrying a licensed reviewer, and it can carry a licensed
reviewer while being wrong, so one field cannot do both.

**The two CHECK constraints are the point of this whole section.** The first
makes the review gate structural rather than a habit: a translation row
physically cannot reach `published` without a completed check. The second stops
the translator signing off their own work, which is the single most common way
this gate gets quietly skipped when a deadline is close. See §9a.

**Why a side table rather than a `lang` column on `articles`:** every existing
query, RLS policy, publish gate, lint rule and MCP tool assumes one row per
article. A side table leaves all of that untouched. It also makes "which pages
have Spanish, and which Spanish pages are stale" a single query.

**`source_updated_on` is the operational field that matters.** It records the
English row's `updated_on` at the moment the translation was written. When the
English page is corrected and the Spanish is not, that gap is visible and
queryable. Without it, the Spanish site silently becomes the place where the
retracted version still lives, which is exactly the failure this repo has
already shipped twice (see `panama-v2-live-cms-and-mcp`).

### 0014: `project_translations` and `area_translations`

Editorial fields only. The catalog facts (prices, beds, m², amenities,
delivery dates) are language-neutral and must not be duplicated.

- Projects: `hook`, `location_note`, `suits`, `drawbacks`, `buying_note`,
  `title_note`, `faqs`, `summary`, `body`
- Areas: `positioning`, `blurb`, `cost_of_living_note`, `getting_around_note`,
  `suits`, `drawbacks`, `title_note`, `faqs`

Amenity labels come from `lib/amenities.ts`, which is a hand-kept map. Add a
Spanish label per amenity there, no migration needed.

### Categories

Four rows, hand-kept in `lib/content.ts`. Add `nameEs`, `slugEs`, `blurbEs`,
`metaTitleEs`, `metaDescriptionEs`. No migration.

### Sources are shared, never duplicated

Every language version reads the same `sources` array. Most of our primary
sources are already Spanish-language Panamanian government documents: ANATI,
Registro Público, MEF, Gaceta Oficial, MIDA. The Spanish page cites them in
their own language with no translation friction at all, which is a genuine
E-E-A-T advantage the English version does not have.

**German inherits the friction rather than the advantage.** A German reader
meets a citation to *Gaceta Oficial* No. 29891 and cannot read it. Do not
translate source titles, which would make them unfindable, and do not drop
them. Cite the document in Spanish with a short German gloss of what it is
("Amtsblatt") and what it establishes. The source list is the site's entire
credibility claim and it stays intact in every locale.

---

## 4. hreflang

Emitted **only where a translation actually exists**. This is the rule that
breaks most implementations.

On the English article:

```ts
alternates: {
  canonical: "https://panamarealestateguide.com/buying/buying-property-in-panama",
  languages: {
    "en": "https://panamarealestateguide.com/buying/buying-property-in-panama",
    "es": "https://panamarealestateguide.com/es/comprar/comprar-propiedad-en-panama",
    "x-default": "https://panamarealestateguide.com/buying/buying-property-in-panama",
  },
}
```

On the Spanish article, the same block with `canonical` pointing at the Spanish
URL. The tags must be reciprocal or Google discards the whole cluster.

Rules:

1. **Bare language codes: `de`, `es`. Never `de-DE`, `es-PA` or `es-419`.** One
   German version serving Germany, Austria and Switzerland, which is decision 7
   in §11 and the reason a ccTLD was rejected. Regional codes only if we ever
   fork content per country, and we should not.
2. **`x-default` points at English.** It is the fallback for everyone we do not
   have a language for, and English is the wider net.
3. **Absolute URLs, exact match, no trailing-slash drift.** A mismatch of one
   character invalidates the pair.
4. **Untranslated `/de/…` must 404 hard.** Not a soft fallback to English, not
   a redirect. A `/de/` URL serving English content is a duplicate-content
   problem and a bad user experience at the same time.
5. **Check `_redirects` and `netlify.toml`.** 308 lines of v1 redirect rules,
   plus the `/de/*` wildcard 410 and the §1a recovery map. Confirm that no
   **new** `/de/` URL matches any of them. This is sharper for German than it
   was ever going to be for Spanish: we are deliberately running 301s inside the
   same prefix as the new pages, so a new German URL that accidentally matches a
   recovery rule would 301 to itself or to the wrong page. A hreflang target
   that 301s is a hreflang target Google drops, and this site has already had a
   redirect-chain incident (`panama-v2-cutover-and-deploy-gotchas`).
6. **Sitemap carries the alternates too.** `MetadataRoute.Sitemap` supports
   `alternates.languages` per entry. One sitemap, not two, so the pairing is
   asserted in both places.

Also: `og:locale` (`en_US` / `de_DE` / `es_PA`) and `og:locale:alternate`, and
`inLanguage` on every JSON-LD block. Note `og:locale` does take the regional
form even though hreflang does not, which is an Open Graph quirk rather than an
inconsistency to fix.

---

## 5. What gets translated, and what does not

Not all 120 URLs. The dividing line is whether the search intent survives the
language change.

### German scope, Phase 1 (active)

**The German tier list is evidence-led, not inferred.** Every page below is on
the list because German searchers are already landing on its v1 counterpart.
This is the one advantage German has over Spanish and it should be used rather
than overridden by an intuition about what a buyer ought to want.

**Tier A-DE, 18 pages.** The §1a inventory minus the two whose English source
is still draft, plus the structural pages:

- Structural: `/de/` home, the four category hubs, `/de/regionen`,
  `/de/projekte`, `/de/kontakt`, `/de/so-arbeiten-wir`.
- Relocation core, the highest-demand cluster:
  `retire-in-panama`, `best-places-to-retire-in-panama`,
  `panama-healthcare-costs-2026`, `panama-cost-of-living-2026`,
  `safety-in-panama-2026-real-data-rumors`, `panama-drivers-license-foreigners`,
  `getting-around-panama-city-guide`, `moving-to-panama-with-pets`
- Place and property:
  `best-neighborhoods-panama-city-expats`, `panama-real-estate-market-2026`,
  `bocas-del-toro-real-estate`, `best-beaches-panama-expats`
- Money: `atm-cash-panama-guide`, `panama-banking-non-residents-guide`,
  `sending-money-panama-wire-transfer`
- Comparison: `panama-vs-colombia-retirement`, `panama-vs-costa-rica-retirement`
- Residency: `start-business-panama-foreigners`

**Note where this departs from the Spanish tiering, and why.**
`moving-to-panama-with-pets` and the whole `panama-vs-*` family sit in Tier C
for Spanish, correctly, on the grounds of wrong audience. For German they carry
real measured demand: a German retiree weighing Panama against Costa Rica is a
genuine query shape in a way that a Colombian one is not, and the pet-import
question is a live obstacle for a German relocator. **Tiering is per-locale.
Do not copy the Spanish tiers across.**

**Tier B-DE: the buying pillar, deliberately deferred.**
`buying-property-in-panama`, `titled-vs-rights-of-possession`,
`panama-property-buying-process-guide`, `condos-for-sale-panama-buyers-guide`.
Zero measured German demand today. They are the pages that convert, so they are
not cancelled, but they are written in Phase 3 once Phase 2 shows whether the
German relocation traffic walks down the funnel. Writing them first would be
building on the same guess we are trying to stop making.

**Tier C-DE: everything else**, including the entire domestic-Panamanian set,
which has no German reader by definition, and the `moving-to-panama-from-*`
cluster except a possible future `auswandern-nach-panama-aus-deutschland`, which
would be new writing rather than a translation.

**Areas and projects.** None are in Tier A-DE. The German inventory contains one
area-shaped page (`bocas-del-toro-real-estate`) and no project pages. Translate
areas and projects in Phase 3, driven by whatever the German hub and relocation
cluster actually feed into.

### The Spanish tiers below are queued, not active

Everything from here to the end of §5 is the Spanish scope, settled 2026-08-10
and unchanged. It runs after German. Read §12 for its status.

### This is near-parity, not a separate site

Worth stating up front, because "transcreation" and "Tier C" can read like a
plan for two different websites. It is not.

| | Count |
|---|---|
| Spanish pages that are direct counterparts of an English page | ~40 |
| Spanish-only pages with no English twin | 3 |
| English pages with no Spanish version | ~25 |
| Spanish-only pages in the deferred Tier B | 0 for now |

So about **93% of the Spanish site is the English site in Spanish.** Same facts,
same figures, same sources, same structure, same argument, same conclusions. A
counterpart page is a counterpart page.

**"Transcreation" is about how the sentences get built, not about what they
say.** It means writing in Spanish from the source material rather than
converting English sentences, so the legal terms of art are the ones Panamanian
institutions actually use and the headline fits the 60-character budget in
Spanish. The claims do not move. If the English page says the transfer tax is
2% on cadastral value, the Spanish page says exactly that, citing the same DGI
form.

Full parity is the thing being rejected, and only for the ~25 pages where the
Spanish reader does not exist. There is no Spanish audience for "Moving to
Panama from Texas". Translating it would add a page competing for nothing, on a
site whose whole thesis is that thin pages are the problem.

Near-parity is also what makes hreflang work. Pairs are the mechanism. A
Spanish site built as something wholly separate would forfeit it and end up
splitting one domain's authority across two properties.

### Tier A: translate. Intent is identical. (~40 URLs)

Structural: homepage, 4 category hubs, `/es/zonas`, `/es/proyectos`,
`/es/contacto`, `/es/como-trabajamos`.

Buying pillar:
`buying-property-in-panama`, `panama-property-buying-process-guide`,
`titled-vs-rights-of-possession`, `condos-for-sale-panama-buyers-guide`,
`panama-real-estate-market-2026`, `panama-real-estate-investment-lifestyle-2026`

Money: `panama-property-tax-exemption-extended`, `panama-cost-of-living-2026`,
`panama-banking-non-residents-guide`, `sending-money-panama-wire-transfer`

Residency: `panama-residency-guide`, `apostille-documents-panama-visa`,
`start-business-panama-foreigners`

Areas: the 8 with the strongest sourcing and commercial weight (Costa del Este,
Punta Pacífica, Marbella, Obarrio, Santa María, Boquete, Buenaventura,
Playa Venao).

Projects: the 10 published pages with a price source and the most FAQ depth.

Country-targeted guides, **new writing rather than translation**: *Panamá para
colombianos*, *para venezolanos*, *para mexicanos*. Promoted into Tier A by the
audience decision in §11. These are not Spanish versions of
`panama-vs-colombia-retirement`, which is written for an American reader
weighing two countries. These are written for someone already deciding on
Panama, and the questions are different: what a Colombian passport needs for
residency, how money moves from a Colombian bank, whether a mortgage is
available to a non-resident regional buyer.

### Tier B: domestic Panamanian buyers. Deferred, see §11.

Written up so the option stays on the table, not scheduled. Phase 2 reopens it
against real data. These are **new writing, not translation**:

- Financing as a Panamanian or resident buyer (hipoteca, tasa preferencial,
  the Banco Nacional and Banco General products). No English page exists
  because it does not apply to the English audience.
- Ley de Propiedad Horizontal: what a PH actually is, what the reglamento binds
  you to, cuota de mantenimiento.
- Avalúo and impuesto de inmueble from the resident's side, not the
  foreign-buyer's.
- Ley 80 / ATP short-term-rental permits in Spanish. Note the correction in
  `panama-ley80-atp-permit-geography` applies here identically.
- The country-targeted guides v1 tried and abandoned: `panama para
  colombianos`, `para mexicanos`, `para venezolanos`. These are not
  translations of `panama-vs-colombia-retirement`; they are a different article
  for a different reader.

### Tier C: do not translate

`moving-to-panama-from-texas`, `-from-uk`, `-from-canada`,
`panama-vs-portugal-retirement`, `-vs-spain-`, `-vs-belize-`,
`-vs-costa-rica-`, `-vs-mexico-`, `-vs-colombia-`,
`panama-for-digital-nomads-2026`, `moving-to-panama-with-pets`.

Wrong audience. A Spanish translation of "Moving to Panama from Texas" competes
for nothing and adds a thin page to a site whose entire thesis is that thin
pages are the problem.

---

## 6. Transcreation, not translation

**No machine-translation pass, at any stage.** This site's positioning is
verified figures with named sources. The failure mode is precise and
predictable: Panamanian property law has terms of art that a general translator
gets wrong in a way that reads fluent and is legally meaningless.

Rights of Possession is **derechos posesorios**. Not "derechos de posesión",
which is not the term ANATI uses and is not what a Panamanian lawyer will
recognise. That single distinction is the central claim of this website.

### German has a worse version of this problem, not a milder one

In Spanish the failure mode is choosing a fluent Spanish term that Panamanian
institutions do not use. Bad, but the reader is still in the right legal
system.

In German the failure mode is that **an exact-looking German legal term already
exists and means something specific under German law.** A translator renders
*derechos posesorios* as **Besitzrecht** because that is what the dictionary
says, and a German reader now applies BGB possession doctrine to a Panamanian
ANATI parcel. The sentence is fluent, the term is real, and the reader has been
handed a false model of what they would be buying. That is materially worse than
a term nobody recognises, because nothing signals to the reader that anything
went wrong.

**Rule: Panamanian legal terms of art stay in Spanish, italicised, glossed in
German on first use in each page. Never substituted with a German legal term.**

| Concept | Render as | Never |
|---|---|---|
| Rights of Possession | *derechos posesorios* (gloss: "ein Besitztitel ohne Grundbucheintrag") | Besitzrecht, Besitzanspruch |
| titled land | *título de propiedad* (gloss: "eingetragenes Volleigentum") | Eigentumstitel alone |
| condominium regime | *propiedad horizontal* (PH) | Wohnungseigentum, WEG |
| public deed | *escritura pública* | notarielle Urkunde |
| Public Registry | *Registro Público* | Grundbuch |
| purchase promise agreement | *promesa de compraventa* | Vorvertrag, Kaufabsichtserklärung |
| HOA fee | *cuota de mantenimiento* | Hausgeld |
| appraisal | *avalúo* | Wertgutachten |
| transfer tax | *impuesto de transferencia* | Grunderwerbsteuer |
| VAT | ITBMS | Mehrwertsteuer, MwSt |
| pre-construction | *preventa* | Bauträgerkauf |

**Grundbuch for Registro Público is the single most dangerous one on this
list.** The German Grundbuch carries a state guarantee of title
(*öffentlicher Glaube*). The Panamanian Registro Público does not work that way,
and the entire reason this site exists is to explain what that difference costs
a buyer. Calling it a Grundbuch destroys the article's own argument in one word.

The German glossary is a deliverable in the same sense as the Spanish one:
written and agreed before the first page, not assembled as translators hit
problems.

### Spanish glossary, queued with the Spanish build

| English | Panamanian Spanish |
|---|---|
| Rights of Possession (ROP) | derechos posesorios |
| titled land | tierra titulada / título de propiedad |
| closing costs | gastos de cierre |
| transfer tax | impuesto de transferencia |
| capital gains | ganancia de capital |
| public deed | escritura pública |
| Public Registry | Registro Público |
| purchase promise agreement | promesa de compraventa |
| condominium regime | propiedad horizontal (PH) |
| HOA fee | cuota de mantenimiento |
| appraisal | avalúo |
| pre-construction | preventa |
| VAT | ITBMS |

### Register

**German: `Sie`, decided 2026-08-13.** Same reasoning as `usted`, and stronger.
The German audience skews retirement-age, the subject matter is legal and
financial, and `du` from an unknown commercial site reads as either a startup
affectation or a scam. Hold `Sie` across every page, form label, error string,
CTA and the 404.

German spelling is the Federal Republic standard, with **ß retained** in body
copy (Swiss readers accept ß; German readers read `ss` as Swiss or as sloppy).
Slugs are the exception, see §2. Currency is written `USD 250.000` or
`250.000 USD` with the German thousands separator, and the fact that Panama uses
the US dollar is worth stating explicitly on any page quoting a price, because
a German reader does not know that and will assume a conversion risk that does
not exist.

**Spanish: Panamanian and neutral LatAm.** Never Castilian: no *vosotros*, no
*piso* for apartment, no *coger*. Use *apartamento*, *carro*, *celular*,
*computadora*.

**`usted`, decided 2026-08-10.** Panamanian professional register, and it fits a
site making legal and money claims. Hold it across every page, including form
labels, error copy, CTAs and the 404. The English voice stays direct and
second-person; `usted` carries that directness without the familiarity.

### Metadata budgets change

Both target languages run longer than English for the same meaning: Spanish by
15 to 25 percent, German by 10 to 20 with far worse variance, because a single
compound (*Aufenthaltsgenehmigung*, *Grundstücksübertragungssteuer*) can eat a
third of the title on its own. A 58-character English title lands at 70-plus and
Google truncates it.

Consequence: **titles are written to the ≤60 budget natively, not translated and
then trimmed.** `seo_title` and `meta_description` on translation rows will be
non-null far more often than the near-always-null policy on the English rows
(`panama-seo-metadata-rules`). Extend `lintArticle` in `v2/mcp/lib.js` to run
its budget warnings against translation rows.

German-specific: prefer the shorter native alternative where one exists
(*Wohnsitz* over *Aufenthaltsgenehmigung* where the meaning allows) and split
compounds with a preposition rather than truncating them. Never hyphenate a
compound purely to fit, which reads as a machine artefact.

The house rules carry over unchanged: no em-dash connective tissue, no
trailing-dash punchlines, minimum one source, no `## Frequently asked
questions` heading in the body (`## Preguntas frecuentes` is appended by the
template).

---

## 7. Keyword research is native, not translated

### German, Phase 1

We are not starting cold. §1a gives us the queries German searchers already use
to reach the v1 pages, which is real data rather than a keyword tool's guess:

| Query | Impr (90d) | Pos | Reads as |
|---|---|---|---|
| `panama strand`, `panama strände`, `panama strandurlaub` | 162 | 48–74 | **Tourism, not buyers.** See below. |
| `plan b panama` | 20 | 51.4 | Second residency / flag theory. High intent. |
| `rentner in panama`, `auswandern panama rentner` | 19 | 59–62 | The core audience. |
| `lebenshaltungskosten panama`, `lebenskosten panama` | 3 | 34–51 | Cost research, mid-funnel. |
| `auswandern nach panama`, `auswandern panama immobilien` | — | 74–140 | The head term. We are nowhere. |

Three things fall out of this:

1. **`auswandern` is the head term and we rank at position 74 to 140 for it.**
   Every German page should be built around the *auswandern* frame rather than
   the *relocation* frame. It is not a synonym: *auswandern* carries a
   permanence and a life-decision weight that *relocate* does not, and the
   German content that ranks for it is written accordingly.
2. **`plan b panama` is the most interesting query in the set.** It is the
   German second-residency and asset-diversification audience, it is
   high-intent, and it is currently landing on `/de/articles/` (a bare index) at
   position 51. That is a page we do not have and should write, in German, as
   new writing rather than a translation. Nothing in the English tree serves it.
3. **The beach queries are a trap.** 162 impressions is the single largest
   German cluster in the data and it is holiday intent, at position 48 to 74.
   Translating `best-beaches-panama-expats` to chase it means competing with
   German travel publishers for readers who will never buy property.
   **Recommendation: keep the page in Tier A-DE for the 301 (it holds a ranking
   we own) but do not optimise it or invest writing effort in it, and do not
   count its impressions as evidence of anything.** It is in the list because
   the URL has equity, not because the traffic is good.

The competitive set for German is neither the English one nor the Spanish one.
It is German expat and *auswandern* publishers, `auswandern-info`-style sites,
German-language YouTube relocation channels, and the German second-residency
consultancies. Not International Living, not Encuentra24. Every Tier A-DE page
needs its own German SERP teardown before writing.

German UGC lives in different places too: the *Auswandern* subforums, German
Facebook expat groups, `auswandern.net`-type boards, and German YouTube
comments, which are unusually substantive for this topic. Reddit is much weaker
in German and should not be the primary source.

### Spanish, queued

Every Tier A page gets its own Spanish SERP teardown. Translating the English
keyword produces the wrong target more often than not.

- "Panama real estate" translates to *bienes raíces Panamá*, but the query with
  the volume and the commercial intent is *apartamentos en venta en Panamá*.
- "Closing costs in Panama" translates cleanly, but the query people actually
  type is *cuánto cuesta comprar una casa en Panamá*.
- "Best neighborhoods in Panama City" becomes *dónde vivir en Ciudad de
  Panamá*, which is a different article shape.

The competitive set changes completely too. The Spanish SERP is Encuentra24,
CompreoAlquile, Panamá Realtor and local brokerage blogs, not International
Living and the expat-blog cluster. Note that CompreoAlquile 403s our fetcher
and Encuentra24 search pages do not fetch (`panama-price-sources-and-portals`),
so the teardown needs the browser rather than WebFetch.

The `panama-writer` skill already does SERP teardown and UGC mining. It needs a
Spanish mode: Spanish-language UGC sources are different (Reddit r/Panama in
Spanish, Foros Panamá, Facebook groups) and the skill currently mines
English-language expat forums.

---

## 8. Engineering checklist

Written locale-generically. Phase 1 instantiates it for `de`.

0. **The `/de/` 301 recovery map, and it goes first.** Per-URL 301s from each
   old `/de/articles/{slug}.html` to its new German counterpart, placed **above**
   the `/de/*` wildcard 410 in `netlify.toml`, which stays for the ~385 URLs not
   being revived. Ships in the same deploy as the German pages it points at,
   never before: a 301 to a 404 is worse than the 410 it replaced. See §1a for
   the map and the three consolidation calls.
1. Route tree under `app/(de)/de/`, plus one root layout per route group for
   `<html lang>`.

   **Root layout split DONE 2026-08-13**, once the CRM work committed. There is
   no `app/layout.tsx` any more. The fonts, `metadataBase` and the Typekit link
   live in `components/document-shell.tsx`, and `(site)` and `admin` each own a
   root layout rendering `<DocumentShell lang="en">`. `app/api/*` needed
   nothing, being route handlers that render no HTML. Verified: `/` and
   `/admin` both serve `lang="en"` with the fonts and Typekit link intact.

   **The route tree under `app/(de)/de/` is still outstanding**, and it brings
   its own root layout with it:

   ```tsx
   // app/(de)/layout.tsx
   export default function DeLayout({ children }) {
     return <DocumentShell lang="de">{children}</DocumentShell>;
   }
   ```

   That was proved against a throwaway `/de` page, which served `lang="de"`
   while `/` stayed `lang="en"`; the probe was removed rather than left as an
   empty route group. The `<html lang>` gate in §9 stays until the German pages
   are real.
2. `lib/i18n.ts`: `Locale` type, category slug maps both directions, a
   `localePath()` builder, and `Intl` formatters bound to the locale
   (`de-DE` for German dates and number formatting, `es-PA` for Spanish).
   **Currency stays USD in every locale** and is formatted with the locale's
   separators, not converted.
3. Data layer takes a locale: `listArticles(locale)`, `getArticleFull(locale,
   …)`, `getProject(locale, …)`, `getArea(locale, …)`. **A missing translation
   returns null, never the English row.** Silent English fallback is how a
   half-translated site ends up serving duplicate content under hreflang tags
   that claim otherwise.
4. `generateMetadata` on all six dynamic routes plus the hubs emits reciprocal
   `alternates.languages`, gated on translation existence.
5. JSON-LD: `inLanguage`, translated `FAQPage` and `BreadcrumbList`. The
   `Organization` entity stays single and shared.
6. `app/sitemap.ts`: one sitemap, per-entry alternates, translated URLs only.
7. Language switcher in header and footer. It links to the **equivalent** page,
   not the `/es` homepage. If the current page has no translation, hide the
   switcher rather than dumping the reader on the wrong page.
8. **No IP or Accept-Language auto-redirect.** Google's crawler comes from the
   US and would never see the Spanish tree. A dismissible banner is the only
   acceptable form of this.
9. **Lead form in the target language, and record the locale on the lead row.**
   The broker needs to know which language to open in before they dial. This is
   the piece that is easy to skip and directly costs money when skipped.
   Migration 0006 added `intent`; the same table needs `lang`.

   **German CTA carries an explicit language expectation** (decision 5, §11).
   The page is German, the call is in English. Say so on the form rather than
   in a footnote, in one plain German line, and do not apologise for it. A
   German reader who discovers this on the call feels misled; one who reads it
   on the form does not care.
10. Keep the honeypot field name identical across locales so the existing bot
    filter keeps working (`panama-ga4-properties-and-bot-traffic`).
11. Turnstile and the thanks page localised. `/es/contacto/gracias` joins
    `/contact/thanks` in the robots disallow list.
12. Spanish 404 page under `app/(es)/es/not-found.tsx`.
13. GA4: locale as a content group or custom dimension. The built-in `language`
    dimension is the **browser** language, not the page language, so it cannot
    answer "how is the Spanish site performing".
14. Search Console: add a URL-prefix property for
    `https://panamarealestateguide.com/es/`. The domain property will not
    segment it usefully on its own.
15. Meta Pixel and CAPI: pass locale so audiences do not merge.
16. MCP server (`v2/mcp/server.js`): new tools `create_translation`,
    `update_translation`, `list_translations`, `submit_translation_check`
    (sets `checked_by` and `checked_on`, see §9a), and a `translation_audit`
    that reports two things: rows whose `source_updated_on` is behind the
    English `updated_on`, and rows that are written but unchecked. The second
    is the Phase 1b queue and it needs to be visible rather than remembered.

---

## 9. Verification gates

Nothing ships until all of these pass on the pilot set.

- [ ] **Every URL in the §1a recovery map resolves 301 → 200 in one hop, to a
      German page that is actually published.** Check all of them, not a sample.
      This gate is the entire justification for doing German first.
- [ ] **The `/de/*` wildcard 410 still fires for a slug not on the map.** If the
      per-URL rules broke the wildcard, we have just resurrected 385 dead
      machine-translated URLs.
- [ ] hreflang reciprocity confirmed in both directions on five sample pages,
      via rendered HTML, not source.
- [ ] Every new `/de/` URL returns 200 or 404. Zero 302s, and no 301s except
      the recovery map above.
- [ ] **Submit the recovery-map URLs for reindexing** and confirm in GSC that
      the 410s clear. They have been serving 410 since 2026-07-31 and Google
      de-indexes 410s deliberately fast.
- [ ] `<html lang>` correct on both trees.
- [ ] Untranslated `/es/` slug 404s rather than rendering English.
- [ ] **Every published translation row has `checked_by` and `checked_on` set,
      and `checked_by <> translator_id`.** Enforced by CHECK constraints in §3,
      verified here because a constraint that was never tested is not a
      constraint. Try to publish an unchecked row and confirm the database
      refuses.
- [ ] Every published translated page carries at least one source, same gate as
      English.
- [ ] `lint_article` budget warnings clean on every translation row.
- [ ] No English string leaks in the rendered page. Grep the rendered HTML for
      known UI strings ("Talk to us", "How we work", "Verified on", "Read more",
      month names).
- [ ] **No German legal term from the §6 forbidden column appears anywhere in
      the German tree.** Grep for `Grundbuch`, `Besitzrecht`, `Wohnungseigentum`,
      `Grunderwerbsteuer`, `Hausgeld`. Any hit is a blocker, not a nitpick.
- [ ] **`Sie` held throughout.** Grep the rendered German HTML for `du `, ` dein`,
      ` deine`, ` dir `, and check every form label and error string by hand.
      Form and error copy is where `du` gets in, because it is written by
      whoever built the component rather than by the writer.
- [ ] Sitemap validates and contains alternates only for pages that exist.
- [ ] Lead submitted from `/de/kontakt` lands with `lang = 'de'` and reaches the
      broker notification carrying the language flag.

---

## 9a. The review pass is its own step, not part of writing

Added 2026-08-13. **A translation is not done when it is written. It is done
when somebody who did not write it has read it against the English source.**

This is not process for its own sake. The pages that created the problem in §1a
were machine-translated and shipped without anyone who reads German ever
looking at them, and they sat live for months. The failure mode is specific:
translated text fails silently. Broken English is obvious to everyone in the
room; fluent, confident, wrong German is invisible to a team that does not read
German, and it stays invisible until a reader acts on it.

### Where it sits

Write → **check** → publish. The `checked_by` constraint in §3 makes this
structural: an unchecked row cannot reach `published`.

The check is a distinct calendar step with its own owner, not the last hour of
the writing task. If the person who wrote it is the person who checks it, the
step did not happen, which is what the second CHECK constraint enforces.

### What the checker does

Against the English source open side by side, not from the German alone:

1. **Every figure, date, fee and legal citation matches the English row.** This
   is the highest-value check and it goes first. A translated page that drifts
   on a number is this repo's known failure mode
   (`panama-v2-content-status`), and a wrong number in German is harder to
   catch later than a wrong number in English because fewer people read it.
2. **Every claim matches.** Not just the numbers. If the English page hedges,
   the German hedges. Translation is where "may be exempt" becomes "is exempt",
   because the hedge is the hardest part to carry across.
3. **Terminology against the §6 glossary.** Any forbidden German legal term is
   a blocker, not a comment. `Grundbuch` for *Registro Público* fails the page
   on its own.
4. **`Sie` held everywhere**, including form labels, error strings, the CTA and
   the 404.
5. **Sources intact.** Every source on the English row is present, titles
   untranslated, German glosses accurate.
6. **It reads as German.** Written-in-German, not translated-from-English. This
   is the check that cannot be automated and is the whole reason a human does
   this. If it reads like the pages we just 410'd, it fails.
7. **Metadata budgets** (§6) hold in German.

Items 3, 4 and 7 are partly greppable and those greps are already in §9. **The
greps do not replace the read.** They catch the terms we predicted; the reader
catches the ones we did not.

### Who

**Open, and it gates Phase 1 writing.** Requirements: reads German at native or
near-native level, is not the translator, and can follow a figure back to a
Spanish-language government source well enough to confirm the German page
carries it correctly.

It does not require a real estate licence, which is what separates this role
from the `reviewer_id` question in §11 and makes it much easier to fill. A
competent bilingual editor can do this. A second translator can do this for
another translator's pages, which is the cheapest workable arrangement if we
are using more than one.

**If this role cannot be filled, Phase 1 does not ship.** That is a real
constraint and it is better to hit it now than after 18 pages are written. The
alternative, publishing German nobody has read, is precisely what put us in
§1a.

### Recording it

`checked_by` and `checked_on` on the translation row, set by the checker rather
than by the writer. The MCP gets `submit_translation_check` alongside the
translation tools in §8.16, and `translation_audit` reports rows that are
written but unchecked, so the queue is visible rather than remembered.

---

## 10. Sequencing

Rewritten 2026-08-13 for German-first.

**Phase 0, infrastructure, no content.** Migrations 0013 and 0014,
`lib/i18n.ts`, the route tree, hreflang, sitemap, switcher, lead-form locale.
Ships with one translated page so it is testable end to end. No SEO impact
expected and none wanted. Built locale-generically, so Spanish later is
configuration rather than a second implementation.

**Phase 1a, write, 18 pages.** All of Tier A-DE from §5.

**Phase 1b, check, all 18.** The §9a review pass, by someone who did not write
them. A separate step with its own owner and its own calendar time. Budget for
it properly: this is a close read against an English source, not a proofread,
and pages will come back for rework. Assume a meaningful fraction do.

Nothing from 1a ships until its check passes, and the `checked_by` constraint in
§3 enforces that rather than trusting it.

**Phase 1c, ship, one deploy.** The checked pages plus the §1a 301 map,
together. The page list is dictated by which URLs already hold rankings, so a
partial ship leaves the rest of them 410ing, and a 301 pointing at a page that
did not ship is worse than the 410 it replaced. Get the whole recovery set out
at once.

The success criterion is narrow and worth stating so it is not moved later:
**the recovered URLs stop 410ing, get recrawled, and hold or improve the
positions they have now.** Not lead volume. Per §1a, German traffic is
top-of-funnel and Phase 1 is not a conversion test.

**Phase 2, measure, 6 to 8 weeks.** German indexation, impressions and position
in a `/de/` URL-prefix Search Console property. Then the two questions that
actually decide what happens next:

- Do the recovered pages hold position once they are real German pages with
  hreflang rather than orphaned MT pages? If they drop, the whole premise was
  wrong and we should know that before writing Tier B-DE.
- Does German relocation traffic walk down the funnel to areas and projects at
  all? This is what gates Tier B-DE, the buying pillar.

**Phase 3, scale, whichever the data points at.** Tier B-DE (the German buying
pillar) if Phase 2 shows funnel movement, German areas and projects if it shows
where they go, or the Spanish build if German plateaus. Deliberately not
decided now.

**Spanish** picks up at Phase 1-ES against the same Phase 0 infrastructure, with
its own decisions from §12 intact.

---

## 11. Decisions

### Settled by Charles on 2026-08-13 (German)

5. **German ships first, Spanish stays queued.** Rationale in §1a: German is the
   only locale with measured rather than hypothesised demand, and the asset is
   currently bleeding. Spanish keeps every decision below unchanged and runs
   against the same Phase 0 infrastructure.

6. **The broker takes German enquiries in English.** German expats relocating to
   Panama generally operate in English, and the alternative gates the whole
   build on a hire. Consequence: the German CTA states the language plainly on
   the form (§8.9). Accepted cost: some conversion loss at the form, in exchange
   for shipping now.

7. **Audience: German-speaking relocators and second-residency buyers**, DACH
   rather than Germany alone. Austria and Switzerland are a third of the click
   volume on a fraction of the impressions, and nothing in the content needs to
   change to serve them. Consequence: no ccTLD (§2), and no German-only framing
   in copy that would read wrong in Vienna or Zug.

8. **Register: `Sie`.** See §6.

### Open, needs a decision before Phase 1 writing starts

- **Who does the §9a language check?** This is the blocking one, and it is a
  resourcing question rather than a design question. Needs a German reader who
  is not the translator. No licence required, so a bilingual editor or a second
  translator qualifies. **Phase 1 does not ship without it** (§9a).

  Not the same question as the reviewer badge below, and worth keeping apart:
  this one is an internal gate that always happens, that one is a public claim
  that may or may not render.

- **Who reviews the German pages, and does the review badge render?** The
  Spanish answer was David Aguirre, and it worked because he practises in
  Spanish and takes client calls in it. **That reasoning does not carry to
  German: he cannot read the page he would be signing.** A reviewer badge on
  text the reviewer cannot read is the kind of trust signal this site exists to
  argue against.

  Three options, none of them free. (a) No reviewer badge on the German tree,
  and the German page is visibly weaker on E-E-A-T than the Spanish one will be.
  (b) David reviews the **English source**, and the German page carries a
  differently-worded credit naming him as reviewer of the source and the
  translator by name, which is honest but is a new template slot. (c) Recruit a
  German-speaking reviewer, which gates Phase 1 on a hire.

  **Recommend (b).** It is true, it is buildable, and it keeps the licence claim
  attached to the thing the licence actually backs. It needs template work and
  wording that does not overclaim, so it is worth deciding before the writing
  starts rather than after.

- **The three consolidation mappings in §1a** (`10-best-places`,
  `panama-weather-guide`, `how-to-buy-property`). Recommendations are recorded
  there; they need a yes.

### Settled by Charles on 2026-08-10 (Spanish, queued)

1. **Audience: Spanish-speaking foreign buyers.** Colombia, Venezuela, Mexico,
   Spain. They mirror the existing content and funnel almost exactly, so the
   Tier A translations do most of the work.

   **Consequence: Tier B is deferred, not cancelled.** The domestic-buyer pages
   (hipoteca, propiedad horizontal, avalúo from the resident's side) stay
   written up in §5 but are not scheduled. Phase 2 reopens the question against
   real ES Search Console data rather than a guess about whether we can take on
   Encuentra24.

   **Consequence: the country-targeted guides move up.** *Panamá para
   colombianos*, *para venezolanos*, *para mexicanos* are now core Tier A, not
   Tier B. They are what v1 tried at
   `/articles/panama-para-colombianos-guia-2026.html` and then 301'd away, and
   they target this audience directly. Still new writing, not translations of
   the `panama-vs-colombia-retirement` page, which is written for an American
   reader.

2. **Register: `usted`.** See §6.

3. **Broker takes Spanish calls fluently.** The funnel works end to end, so
   Phase 1 can prove the whole chain: Spanish query, Spanish page, Spanish
   lead, Spanish call. The lead row still needs `lang` so the broker knows
   which language to open in before dialling (§8.9).

4. **David Aguirre signs the Spanish pages, for now.** He goes in
   `reviewer_id`, not the byline. That is the slot the template built for him:
   the reviewer renders with an avatar and the licence string, and
   `public/authors` holds exactly one file, `david-aguirre.webp`. The byline
   inherits from the English row, and `translator_id` names whoever actually did
   the translation. Nobody is credited with work they did not do.

   **This is the one place the Spanish site has better E-E-A-T than the
   English.** A Panama-licensed agent reviewing Spanish-language property
   content, in the language he practises and takes client calls in, is a
   stronger claim than the same signature on an English page.

   Three things that follow:

   - **`reviewer_id` is currently null on the English pillars.** Checked
     `buying-property-in-panama` on 2026-08-10: `reviewer_id: null`,
     `reviewed_on: null`, so the "reviewed for accuracy" badge does not render
     there today. The Spanish pages will carry a badge their English
     counterparts do not. Worth asking separately whether David should be
     signing the English pillars too.
   - **`review_needs_date` is a schema constraint.** `reviewed_on` has to be
     set, and it has to be the date he actually read the page. Not backfilled to
     the publish date, not copied from the English row.
   - **Signing is an act, not a field.** Ten pilot pages is a realistic ask.
     Thirty-five is a different conversation, and Phase 3 should not assume the
     signature scales for free.

   **Scope limit worth stating plainly:** David's credential is a real estate
   licence. It backs the property, title and price claims completely. It does
   not back the residency, apostille, business-formation or property-tax pages,
   which are immigration and tax law. That gap already exists on the English
   side and is already acknowledged elsewhere: the Casco Antiguo page is
   recorded as blocked on a tax reviewer. Either keep David's signature on the
   property-side Spanish pages only, or accept the wider signature as an interim
   and recruit a tax or immigration reviewer later. "For now" reads as the
   second. Flagged so it is on the record rather than arrived at by default.

~~**Deferred, noted only:** Germany is the number three country by clicks with
17, on queries like *auswandern nach panama*, and there is no German page on the
site. Everything built in Phase 0 makes `/de` a content decision rather than an
engineering one. Not now.~~

**Superseded 2026-08-13.** This paragraph was right that Phase 0 makes German a
content decision, and wrong about the urgency, because it was written without
looking at what the 410'd `/de/` URLs were still earning. See §1a.

---

## 12. Spanish status

Queued behind German. Nothing about the Spanish scope has changed: §5's tiers,
§6's glossary and `usted`, §7's SERP method and all four decisions in §11 stand
as settled on 2026-08-10.

What German changes for Spanish, all of it favourable:

- Phase 0 infrastructure is shared, so Spanish starts at Phase 1-ES with the
  route tree, hreflang, sitemap, switcher, translation tables and lead-locale
  plumbing already built and proven against a real locale.
- The three-way hreflang cluster (en/de/es) is the same mechanism as two-way. No
  additional work beyond the extra rows.
- German answers a question Spanish would otherwise have had to answer with real
  money: whether a locale tree on this domain can rank at all given the backlink
  profile. If German recovers its rankings, Spanish is a much safer bet. If it
  does not, Spanish was going to fail the same way and we found out for the
  price of 18 pages instead of 43.

**One thing to re-check before Spanish starts, rather than assume:** the Spanish
scope was justified partly on Panama being the number two country by clicks. It
still is (15 clicks, 28 days), but Panama is domestic traffic and §11 decision 1
deliberately scoped Spanish to *foreign* Spanish-speaking buyers, whose markets
(Spain, Colombia) are at one click each. That was a defensible call on 90-day
data in August. Re-run it on fresh data at the time rather than inheriting it.
