# German 1:1: the execution plan

Successor to `german-launch-plan.md`, which covered getting a German tree to
exist at all. That shipped 2026-08-20. This plan covers the decision taken the
same day: **translate the entire site 1:1 into German.**

State verified 2026-08-20 against production and the database, not assumed.

---

## 1. The number

| Surface | English | German today | Remaining |
|---|---:|---:|---:|
| Articles | 49 (~94,000 words) | 2 | **47** |
| Areas | 26 | 0 | **26** |
| Projects (published) | 40 | 0 | **40** |
| Section pages | 8 | 6 | **2** |
| **Total** | **123** | **8** | **115** |

Section pages already in German: home, the four category indexes, contact
(plus its thank-you). Missing: the areas index and the projects index. `/about`
is a third, and is listed under open decisions rather than work, because it
describes an English-speaking editorial process to a German reader.

---

## 2. Two things that could have blocked this, and did not

**The English is stable.** All 49 published articles now carry the
advocate-with-receipts posture; a scan for the three pre-pivot section markers
("When the honest answer is don't", "What we have not verified", "What this page
used to say") returns zero across all 49. The tone-audit rewrite queue from
2026-08-08 is finished. Nothing translated now is about to be rewritten
underneath the translation, which was the single biggest sequencing risk.

**The tables exist.** Migration `0014_project_area_translations.sql` is applied.
`area_translations` and `project_translations` are live and empty, and they
carry the same publish gate as `article_translations`: translator required,
independent checker required, and a `published` flag so a half-translated area
renders **not at all** rather than half in English.

So this is a content-and-routes program, not a schema program. There is no DDL
on the critical path, which matters because there is still no DDL path from the
authoring machine (see `german-launch-plan.md` §8).

---

## 3. The constraint that shapes the whole plan

**The bottleneck is the check, not the translation.**

Every translation row is refused by the database unless `checked_by` is set and
differs from `translator_id`. That is deliberate, and it is the lesson of the
withdrawn machine-translated tree: it sat live and wrong for months because
nobody who reads German ever looked at it. Broken English is obvious to
everyone. Fluent, confident, wrong German is invisible to a team that does not
read German.

At 115 pages, one intern reading every page end to end is the rate limit for
the entire program. Three ways to move it, in preference order:

1. **Blind back-translation on every page, before it reaches a human.** A
   subagent sees only the German, is forbidden from fetching any source,
   renders it back to English, and the result is diffed against the English row.
   On the two pages built so far it found **zero figure drift and ~15 real
   defects each**, including `Nachlass` used for *descuento* (it means a
   decedent's estate). It does **not** validate idiom. Its job is to make the
   human pass a spot-check rather than a full read.
2. **A second checker.** The independence constraint only requires
   `checked_by <> translator_id`, so any second German reader unblocks a queue
   of any size.
3. **The ~$150 freelance spot-check** already offered and not taken up. Buys
   idiom validation on a sample, which nothing available to us can do.

**Do not respond to the bottleneck by relaxing the gate.** The gate is the only
reason this tree is different from the one that was withdrawn.

---

## 4. Phases

Each phase is independently shippable. Later phases need nothing from earlier
ones except P0.

### P0 — Routes and plumbing · engineering only, no content

**Shipped 2026-08-20.** Both detail bodies were extracted into shared
components (`<AreaDetail>`, `<ProjectDetail>`) rather than duplicated, so the
two trees render the same markup and cannot drift. `TitleBadge`, `Stamp`,
`AreaCard`, `ProjectCard` and `ProjectSearch` all take an optional `locale`
defaulting to `"en"`, leaving every existing call site untouched.

Nothing renders until rows are published, so this ships safely on its own.

- [x] `listAreas(locale)` / `getAreaFull(slug, locale)`, returning null on a
      missing translation rather than falling back to English — the rule E1
      already set for articles
- [x] `listProjects(locale)` / `getProjectFull(slug, locale)`, same rule
- [x] `/de/regionen` and `/de/regionen/[slug]`
- [x] `/de/projekte` and `/de/projekte/[slug]`
- [x] `SECTION_SLUGS` for `areas` → `regionen`, `projects` → `projekte`
- [ ] `LIVE_SECTIONS.de` gains `areas`, `projects` — **only once each index has
      at least one published row**, or the header links to an empty page
- [x] `alternatesForSection` extended to areas and projects. It excludes them
      today on purpose, with a comment saying they join "the day /de/regionen
      ships". Pair from the translation tables, never unconditionally: an
      untranslated area must emit a bare canonical.
- [ ] Sitemap emits the German area and project URLs it can prove exist
- [x] Every emitted German URL checked against the four surviving 410 prefixes
      in `netlify.toml` (`/de/articles/*`, `/de/news/*`, `/de/projects/*`,
      `/de/videos/*`). **`/de/projekte` is safe; `/de/projects` is not.** That
      near-collision is the reason this line is in the plan.

### P1 — Articles · 47 pages, ~90,000 words

Ordered by measured German demand. See §6.

### P2 — Areas · 26 pages

The SEO hub layer: every guide and project in an area links here, so authority
concentrates. Three areas already carry German legacy traffic
(`pedasi`, `santa-catalina`, `playa-venao`).

Per `page-types.md`, the highest-value section on any area page is
**"Is {Area} titled?"** — and the German framing needs the `Grundbuch`
correction already made on `immobilienmarkt-panama`: the Registro Público is
**kein Grundbuch im deutschen Sinne**, and a *finca* is "die unter einer eigenen
Registernummer geführte Immobilie", never a "Grundbucheinheit".

### P3 — Projects · 40 pages

Last, deliberately. They are catalogue listings, the German lead form already
says *"Der Makler antwortet auf Englisch"*, and **every one of the 1,938 German
impressions lands on a guide or area URL — none on a project.** Full 1:1 is the
decision; this is the slice with the least demand behind it, so it goes last
rather than not at all.

---

## 5. The pipeline, per page

Unchanged from `german-launch-plan.md` §5, with the back-translation promoted
from optional to mandatory:

1. Draft the German from the English row. Not a literal translation: the German
   page answers German-speaking buyers, which is why the retire page debunks the
   *Katasterwert* claim and the market page debunks *Grundbuch*, neither of which
   appears in the English.
2. `source_updated_on` (articles) / `source_updated_at` (areas, projects) set to
   the English row's current value **at the moment of drafting**. This is what
   makes staleness queryable instead of invisible.
3. Blind back-translation. Diff every figure against the English row.
4. Fix what it finds. Re-run if the fixes were substantial.
5. Human check → `checked_by`, `checked_on` = the date they actually read it.
6. Publish.
7. **Flip the redirect.** If a `/de/articles/*.html` rule points at this page's
   English URL, repoint it at the German one, or hreflang and the redirect
   disagree and Google discards the cluster. Match on the *article*, not the
   filename: two legacy URLs can share one target, which is how
   `pros-cons-retiring-panama.html` and `dollarization.html` were missed on the
   first pass.

---

## 6. Priority order for P1

By clicks, then impressions, from the GSC figures recorded per rule in
`netlify.toml`. 40 of the 49 English articles carry German legacy traffic; the
other 9 have no German signal and go last.

| Clicks | Impr. | Best pos | English page |
|---:|---:|---:|---|
| 6 | 123 | 5.0 | `/living/best-places-to-retire-in-panama` |
| 2 | 119 | 7.7 | `/buying/best-neighborhoods-panama-city-expats` |
| 2 | 59 | 7.7 | `/living/panama-drivers-license-foreigners` |
| 2 | 3 | 2.0 | `/living/panama-vs-colombia-retirement` |
| 1 | **673** | 57.9 | `/living/best-beaches-panama-expats` |
| 1 | 57 | 8.6 | `/living/panama-food-guide-expats` |
| 1 | 50 | 8.0 | `/money/atm-cash-panama-guide` |
| 1 | 37 | 6.6 | `/living/moving-to-panama-with-pets` |
| 1 | 17 | 8.2 | `/living/panama-healthcare-costs-2026` |
| 1 | 12 | 9.5 | `/residency/start-business-panama-foreigners` |
| 1 | 2 | 5.0 | `/buying/bocas-del-toro-real-estate` |
| 0 | 64 | 9.7 | `/living/panama-weather-rainy-season-guide` |
| 0 | 57 | 22.1 | `/living/panama-vs-costa-rica-retirement` |
| 0 | 53 | 26.1 | `/money/sending-money-panama-wire-transfer` |
| 0 | 47 | 12.9 | `/living/getting-around-panama-city-guide` |
| 0 | 47 | 29.9 | `/money/panama-cost-of-living-2026` |
| 0 | 47 | 13.6 | `/buying/panama-property-buying-process-guide` |

Two worth calling out against their rank:

- **`best-places-to-retire-in-panama` is the clear first.** Its German URL sits
  at average position **5.0** and currently hands those readers an English page.
  The English original was rewritten 2026-08-20, so there is no staleness gap.
- **`best-beaches-panama-expats` has 673 impressions**, more than any other
  single page, at position 57.9. Demand with no ranking. Worth doing early for
  the impression pool even though it earns one click today.

---

## 7. How we track this

**Not a checklist in this file.** A checklist of 115 items maintained by hand
goes stale in a week and then lies. The database already knows the answer, and
the tracker should read it.

Progress for any surface is:

```sql
-- Articles: done, drafted, untouched
select
  count(*) filter (where t.status = 'published')                as published,
  count(*) filter (where t.status = 'draft')                    as drafted,
  count(*) filter (where t.id is null)                          as not_started
from articles a
left join article_translations t
  on t.article_id = a.id and t.lang = 'de'
where a.status = 'published';
```

And the thing that actually bites later, staleness:

```sql
-- German pages whose English source has moved on since translation
select a.slug, t.source_updated_on, a.updated_on
from article_translations t
join articles a on a.id = t.article_id
where t.lang = 'de'
  and t.status = 'published'
  and a.updated_on > t.source_updated_on;
```

- [ ] **E5, still not started, is now the tracking tool.** The MCP gains
      `translation_status` (the two queries above across all three surfaces) and
      `list_untranslated(lang, surface)` returning the next page in priority
      order. Once that exists, "where are we" is one tool call rather than a
      document someone has to remember to update.

Until E5 lands, run the queries directly.

---

## 8. Definition of done

A phase is done when all of these hold, not when the pages exist:

- Every page published, each with `checked_by` set and `checked_on` a real date
- Zero rows returned by the staleness query
- hreflang reciprocal on every pair, verified live rather than in source
- Every legacy `/de/` redirect whose target now has German points at the German
- No German URL intercepted by the four 410 prefixes
- `LIVE_SECTIONS.de` matches what actually renders — no header link to an empty
  index

---

## 9. Open decisions

1. **`/about` in German.** It describes an English-speaking editorial process
   and names an English-speaking reviewer. A literal translation makes a promise
   the site does not keep. Either write a German-specific version that states
   plainly that the review happens in English, or leave `about` out of
   `LIVE_SECTIONS.de`. Not decided.
2. **The `/about` reviewer placeholder is still live in English** —
   `lib/content.ts` still reads "Placeholder — needs a named, licensed
   reviewer". Translating that sentence into German would be worse than not
   having the page. Blocks item 1.
3. **Project pages with an English-only broker.** 40 German project pages route
   to a lead form that says the broker replies in English. Decision taken: ship
   them anyway, last.
4. **A second German checker**, per §3. Unresolved and it is the rate limit.

---

## 10. Risks

**Maintenance surface doubles.** 115 German pages each carry a
`source_updated_on`. Every English correction must propagate or the German tree
becomes the place the retraction never reached — which this repo has already
done twice, and is the reason that column exists. The staleness query in §7 is
not optional hygiene; it is the control.

**Translating faster than checking.** Drafts are invisible twice over (RLS hides
them from the publishable key, and the loader filters too), so a backlog of
unchecked drafts is safe. A backlog of *published* unchecked pages is
impossible by construction. The failure mode is not risk to the live site, it is
work sitting idle. Draft ahead freely; publish only behind the gate.

**The `/de/projekte` vs `/de/projects` near-collision.** The 410 catch-all still
covers `/de/projects/*`. German projects live at `/de/projekte/*` and are
therefore safe, but the two differ by two characters and one of them is dead.
Check any new German URL against `netlify.toml` before shipping it.
