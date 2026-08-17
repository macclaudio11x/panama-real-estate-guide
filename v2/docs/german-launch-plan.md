# German launch: the execution plan

**Written 2026-08-16.** The strategy lives in [localisation-plan.md](localisation-plan.md) and is not restated here. This is the build order, with the state of each piece verified against the running system today rather than taken from the plan's assumptions.

Read §1 first. Three things in it are not in the strategy doc and two of them are blockers.

---

## 1. What is actually built, verified 2026-08-16

Probed against the live Supabase REST API and the working tree on `localisation-de`.

| Piece | State | Evidence |
|---|---|---|
| `lib/i18n.ts` | **Done, and more complete than the plan implies** | Exports `LOCALES`, `Locale`, `PageLocale`, UI string table, category + section slug maps both directions, `localePath()`, `htmlLang`, `hreflang`, `ogLocale`, and `formatUsd` / `formatDate` / `formatM2` bound to locale |
| Root layout split | **Done** | No `app/layout.tsx`; `components/document-shell.tsx` holds fonts, `metadataBase`, Typekit; `(site)` and `admin` own root layouts |
| Migration 0013 `article_translations` | **Applied** | `GET /rest/v1/article_translations` → 200, 0 rows |
| Migration 0014 `project_translations`, `area_translations` | **Applied** | Both → 200, 0 rows |
| `app/(de)/` route group | **Does not exist** | `ls app` → `(site)`, `admin`, `api` only |
| Data layer locale-awareness | **Not started** | `lib/content.ts` and `lib/catalog.ts` contain **zero** occurrences of `locale` or `lang` |
| hreflang / `alternates.languages` | **Not emitted anywhere** | Routes emit `alternates.canonical` only |
| Sitemap alternates | **Not started** | `app/sitemap.ts` has no `alternates` |
| MCP translation tools | **Not started** | `mcp/server.js` contains no `translation` |
| `leads.lang` | **Missing** | 31 columns on `leads`; no `lang`. Needs a migration |
| German content | **Zero** | `article_translations` is empty |

### Three findings that change the plan

**(a) Migrations 0011 and 0012 are still not applied, and that blocks *any* deploy of this branch.**
`contacts`, `deals` and `email_messages` all return **404**. `localisation-de` carries the CRM commit (`89a5046`), so deploying this branch without those migrations breaks the admin area in production. This has nothing to do with German and is not mentioned in the localisation plan, but it sits directly across the runway. **Nothing ships until Charles runs 0011 and 0012 in the SQL editor.**

**(b) The stopgap redirects change the sequencing, and for the better.**
Commits `b13c9cb` and `4149934` (committed, not pushed) point 53 old `/de/` URLs at their **English** equivalents instead of serving 410. The strategy doc assumed a single big-bang deploy because *"a 301 pointing at a page that did not ship is worse than the 410 it replaced."* That constraint dissolves once the stopgap exists: every URL already 301s somewhere valid, so German pages can land in batches, each batch flipping its own rules from the English target to the German one. No page ever points at a 404, and there is no all-or-nothing ship.

**(c) The recovery is concentrated enough to ship narrow.**
Six URLs carry 21 of the 28 German clicks in the last 90 days. Tier A-DE is 18 pages. Writing 18 transcreated, individually SERP-researched, human-checked pages before anything ships is a large bet ahead of any evidence that a real German page holds its position. **Recommend shipping six first**, measuring, then continuing. See §3.

---

## 2. The blockers, in the order they bite

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Migrations 0011 + 0012 not applied | Charles, SQL editor | Every deploy of this branch |
| B2 | No §9a language checker identified | Charles | Publishing any German page (DB CHECK enforces it) |
| B3 | `leads.lang` column missing | Charles, SQL editor (migration 0015) | German lead attribution |
| B4 | Reviewer-badge decision for German (§11) | Charles | Page template, so decide before writing |

B2 is the real one. The `article_translations` CHECK constraint refuses `status = 'published'` unless `checked_by` and `checked_on` are set, and refuses `checked_by = translator_id`. That is deliberate and it is the whole lesson of the machine-translated tree we are cleaning up.

**I can draft the German. I cannot be the checker** — the constraint forbids the translator signing their own work, and it is right to. This needs one German-reading human who is not me. No licence required; a bilingual editor qualifies. Until that person exists, German pages can be written and staged as drafts but cannot go live.

---

## 3. Recommended scope for the first ship

**Six pages, not eighteen.** Chosen by clicks and position, not by topic preference.

| Old `/de/` URL | Clicks 90d | Impr | Pos | German target |
|---|---|---|---|---|
| `retire-in-panama.html` | 7 | 276 | 23.6 | `/de/leben/auswandern-nach-panama-als-rentner` |
| `10-best-places-to-live-in-panama-2026.html` | 6 | 123 | **5.0** | `/de/leben/beste-orte-zum-leben-in-panama` |
| `best-neighborhoods-panama-city-expats.html` | 2 | 109 | 7.7 | `/de/kaufen/beste-stadtteile-panama-stadt` |
| `panama-drivers-license-foreigners.html` | 2 | 59 | 7.7 | `/de/leben/fuehrerschein-in-panama` |
| `panama-real-estate-market-2026.html` | 2 | 37 | 5.4 | `/de/kaufen/immobilienmarkt-panama` |
| `panama-vs-colombia-retirement.html` | 2 | 3 | **2.0** | `/de/leben/panama-oder-kolumbien` |
| | **21 of 28** | | | |

Slugs are indicative and get written natively during the SERP teardown, not derived from the English.

**Two notes on this set.**

The second row is the interesting one. It sits at **position 5.0**, the best position the site holds in any language, and the English redirect for that slug has always pointed at `best-neighborhoods-panama-city-expats`, which is a Panama City districts guide rather than a country-wide list of towns. I remapped it to `best-places-to-retire-in-panama` in `4149934` as the nearest honest target. The German page should be written against the *"beste Orte zum Leben"* query it actually ranks for, and the English `/living/best-places-to-live-in-panama` page in the content plan should be written too, so the pair is real rather than approximate.

`best-beaches-panama-expats` is deliberately excluded despite carrying 673 impressions. The strategy doc is right that it is tourism intent at position 58. It keeps its stopgap 301 to English and gets no writing effort.

---

## 4. Engineering work

Ordered by dependency. Estimates are working days for one person, and they are ranges because the data-layer item is the one that can surprise.

### E1. Locale-aware data layer — 1.5 to 3 days
`lib/content.ts` and `lib/catalog.ts` currently have no locale concept at all. Add a `locale` parameter to `getArticleFull`, `listArticles`, `getArea`, `getAreaEditorialFull`, `getProject`, `listProjects`.

The rule that matters, from §8.3 of the strategy: **a missing translation returns `null`, never the English row.** Silent English fallback under a hreflang tag claiming German is the exact duplicate-content failure we are cleaning up.

Ship this behind the existing English call sites unchanged — `locale` defaults to `"en"` and the English tree keeps byte-identical behaviour. That is what makes this safe to land before any German page exists.

### E2. `app/(de)/` route tree — 1 to 2 days
```
app/(de)/layout.tsx            <- <DocumentShell lang="de">
app/(de)/de/page.tsx           <- German home
app/(de)/de/[kategorie]/[slug]/page.tsx
app/(de)/de/[kategorie]/page.tsx
app/(de)/de/kontakt/page.tsx
app/(de)/de/not-found.tsx
```
Thin route files that resolve the locale, call the E1 functions with `locale: "de"`, and render the same components. The layout is the six lines already proved against a throwaway probe. Areas and projects are **not** in the first ship, so `regionen/` and `projekte/` wait.

Untranslated `/de/` slugs must **404 hard**, not fall back to English.

### E3. hreflang + sitemap alternates — 0.5 to 1 day
Reciprocal `alternates.languages` on both trees, emitted **only where a translation exists**. Bare `de` and `en` codes, `x-default` → English, absolute URLs. Same pairing asserted in `app/sitemap.ts`.

The trap specific to us: the stopgap 301s live in the same `/de/` prefix as the new pages. **Every new German URL must be checked against `netlify.toml` and `_redirects` for an accidental match.** A hreflang target that 301s is a hreflang target Google discards, and this repo has had a redirect-chain incident before.

### E4. Migration 0015: `leads.lang` — 15 minutes to write, Charles to apply
Plus the German contact form, the language-expectation line on the CTA (decision 6 — the broker takes German enquiries in English, and the form says so plainly), a localised thanks page added to the robots disallow list, and the honeypot field name kept **identical** across locales so the existing bot filter keeps working.

### E5. MCP translation tools — 1 day
`create_translation`, `update_translation`, `list_translations`, `submit_translation_check` (sets `checked_by` / `checked_on`), and `translation_audit` reporting rows that are stale against the English `updated_on` and rows written but unchecked. Without the audit tool the check queue is remembered rather than visible, which is how it gets skipped.

### E6. Language switcher — 0.5 day
Links to the *equivalent* page, hides itself when no translation exists. No IP or Accept-Language auto-redirect: Google crawls from the US and would never see the German tree.

**Engineering total: roughly 5 to 8 working days**, and E1 is the only genuinely uncertain one.

---

## 5. Content pipeline, per page

Each of the six runs the same track. This is not a translation task and estimating it as one is how it goes wrong.

1. **German SERP teardown.** The competitive set is German *auswandern* publishers and second-residency consultancies, not International Living. Every page needs its own, per §7.
2. **German keyword frame.** `auswandern` is the head term and carries a permanence that *relocate* does not. Build the page around it.
3. **Transcreate from source, not from English sentences.** Glossary in §6 is binding: Panamanian legal terms stay in Spanish, italicised, glossed in German on first use. `Grundbuch` for *Registro Público* fails a page on its own, because the German Grundbuch carries a state guarantee of title that the Panamanian registry does not — which is the site's entire argument.
4. **Metadata written natively to ≤60 characters**, not translated then trimmed. German runs 10–20% longer with bad variance; one compound can eat a third of a title.
5. **Sources carried intact**, titles untranslated, with a short German gloss of what each document is.
6. **`Sie` throughout**, including form labels, error strings, CTA and 404.
7. **The §9a check**, by the B2 human, against the English side by side.

Realistic: **half a day to a day of drafting per page** including the teardown, plus the checker's time, plus rework. Assume a meaningful fraction come back.

---

## 6. Ship sequence

**Ship 0 — stop the bleeding. Ready now, needs only B1.**
Push `b13c9cb` + `4149934`. 53 German URLs stop returning 410 and start resolving to their English equivalents. No German content required. This is triage, not the fix, and it buys time for everything below while the rankings stop decaying.
*Gate: 0011 + 0012 applied first, or the admin area breaks.*

**Ship 1 — infrastructure, no content.**
E1 through E3 and E6, plus one German page as an end-to-end test. English tree byte-identical. No SEO effect expected or wanted.

**Ship 2 — the six pages plus their 301 flips.**
The six from §3, checked and published, with their six `netlify.toml` rules flipped from the English target to the German one. The other 47 keep pointing at English. Submit the six for reindexing in GSC — they have been serving 410 since 31 July and Google de-indexes 410s deliberately fast.

**Ship 3+ — the remaining twelve of Tier A-DE**, in batches, each flipping its own redirects. Areas and projects stay out until Phase 2 says German traffic walks down the funnel.

---

## 7. Gates before Ship 2

From §9 of the strategy, reduced to what applies to a six-page ship:

- [ ] All six URLs resolve **301 → 200 in one hop** to a published German page
- [ ] The `/de/*` wildcard 410 still fires for a slug not on the map — if the per-URL rules broke the wildcard we have resurrected 385 dead machine-translated URLs
- [ ] hreflang reciprocal in both directions, verified in rendered HTML, not source
- [ ] Every new `/de/` URL returns 200 or 404. Zero 302s
- [ ] Untranslated `/de/` slug 404s rather than rendering English
- [ ] Every published row has `checked_by` and `checked_on`, and `checked_by <> translator_id`. **Test the constraint by trying to publish an unchecked row and confirming the database refuses** — an untested constraint is not a constraint
- [ ] Grep the rendered German tree for `Grundbuch`, `Besitzrecht`, `Wohnungseigentum`, `Grunderwerbsteuer`, `Hausgeld`. Any hit blocks
- [ ] Grep for `du `, ` dein`, ` deine`, ` dir `. Check every form label and error string by hand — this is where `du` gets in, because component copy is written by whoever built the component
- [ ] No English UI strings leak. Grep for "Talk to us", "How we work", "Verified on", "Read more", month names
- [ ] A lead from `/de/kontakt` lands with `lang = 'de'` and reaches the broker carrying it

---

## 8. What I need from Charles

1. **Apply migrations 0011 and 0012.** Blocks every deploy, German or not.
2. **Name the language checker.** Blocks publishing. A German reader who is not the drafter; no licence needed.
3. **Reviewer badge for German**, §11. Recommendation on file is option (b): David reviews the English source, the German page credits him as reviewer *of the source* and names the translator. Needs a template slot, so decide before writing.
4. **Confirm the six-page scope** in §3, or tell me to run the full eighteen.
5. **Apply migration 0015** once written, for `leads.lang`.

## 9. Honest risks

- **German URL → English page may still read as a soft 404 to Google** during Ship 0. It is strictly better than a 410 and it is temporary, but it is not free, and if positions keep sliding through Ship 0 that is a signal to accelerate Ship 2 rather than to revert.
- **The backlink profile gates ranking in every language.** German content is additive and does not route around it. If the disavow still has not been submitted, that remains the largest single constraint on all of this.
- **Positions may not hold even once the pages are real.** That is the actual experiment. If six properly-built German pages with reciprocal hreflang cannot hold positions the machine-translated versions held, the premise is wrong and we should learn it at a cost of six pages rather than eighteen — which is the whole argument for the narrow first ship.
