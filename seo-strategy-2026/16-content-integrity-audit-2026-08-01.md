# Content integrity audit, 2026-08-01

All 56 published articles fetched from the live site and scanned for fabricated
evidence and missing sourcing. Run after `/buying/best-neighborhoods-panama-city-expats`
turned out to carry invented testimony during a routine rescue rewrite.

## Result in one line

The fabrication is contained to one page. The missing sourcing is not: 52 of 55
articles render no sources at all, and the line between the two groups is exact.

## Fabricated evidence

**One page.** `/buying/best-neighborhoods-panama-city-expats` carries a section
headed "Real Expat Experiences: What Residents Actually Say" with four quoted
first-person testimonials attributed to named individuals with ages and
occupations, including specific money:

> "Jennifer, 58, Retiree (Casco Viejo) … My $520k condo has appreciated to $580k."
> "David, 35, Investor (Clayton): I bought three units in Clayton at $280k each … 7.7% gross yield."

Same page, invented instrumentation:

- A **Walk Score** column (92, 78, 82, 76, 80, 85, 74, 68). Walk Score publishes
  no coverage for Panama City. These are made up.
- A **Safety Rating** column (High / Very High / Medium-High) with no
  methodology and no source.
- "According to recent expat surveys, 175,000 expats now live in Panama, with
  73% citing safety and walkability as their top two factors." No survey named.

And factual errors:

| on the page | actual |
|---|---|
| "Punta Pacifica: Luxury Living with **Caribbean** Views" | Panama City sits on the Pacific. The name means Pacific Point. |
| Clayton, "working-class neighborhood in transition", cheapest on the list | Former Fort Clayton in the Canal Zone, now Ciudad del Saber, several international schools |
| "El Cangrejo is Panama City's downtown" | A walkable mid-market neighbourhood. The banking district is Obarrio / Área Bancaria. |
| Paitilla, "suburban feel", "you'll drive everywhere" | Dense high-rise waterfront |
| Casco Viejo's rough edge is "eastern … near Curundu" | El Chorrillo, and it is west |

**Cleared: the comparison pages.** `/living/panama-vs-belize-retirement` and
`/living/panama-vs-mexico-retirement` tripped the same scan with six and four
hits. They are not fabrications. Both use explicitly labelled hypotheticals
("Three Retiree Profiles", "Profile 1: Marvin, 68, …"), which is a legitimate
worked-example technique and reads as such. No change needed. Worth recording
because the pattern will trip any future scan, and because
`panama-vs-belize-retirement` is the single page on this site that ranks for a
real human query (position 6.5), so it is the last one to disturb casually.

## Missing sourcing, which is the systemic half

| | pages |
|---|---:|
| No `Sources` block rendered | **52 / 55** |
| No `.gob.pa` citation anywhere | **52 / 55** |
| No FAQPage schema | **22 / 55** |
| WhatsApp CTA inside body content | **47 / 55** |

The template is not the problem. `app/(site)/[category]/[slug]/page.tsx:235`
renders the sources list whenever `article.sources` is non-empty, so the field
is simply empty in Supabase on 52 articles.

### The line is exactly the port boundary

| `updatedOn` | articles | with sources |
|---|---:|---:|
| February 2026 | 23 | 0 |
| March 2026 | 20 | 0 |
| April 2026 | 7 | 0 |
| June 2026 | 2 | 0 |
| **July 2026** | **3** | **3** |

The three sourced pages are `buying/titled-vs-rights-of-possession`,
`buying/boquete-panama-real-estate` and `buying/bocas-del-toro-real-estate`, and
they are the three written natively for v2 against the house standard. The other
52 are the v1 port, carried over with the sourcing discipline that v1 never had.
Two June 2026 pages (`avenida-balboa-panama-real-estate`,
`colon-panama-real-estate`) sit on the v2 side of the calendar but the v1 side of
the standard.

So "every figure carries a source and the month it was checked" is currently
true of three pages out of fifty-five.

## On the verification badge

The proposal is to replace the removed testimonials with a badge marking the
page verified by the editorial team. The badge is right, but it has to follow
the verification rather than fill the hole the testimonials leave. Putting it on
a page whose Walk Scores are invented and whose `sources` array is empty swaps
fabricated testimony for a fabricated verification claim, which is worse: the
first is a bad section, the second is a lie about the site's core promise.

The honest mechanism already exists and is already enforced. `reviewer_id` plus
`reviewed_on` on the article, `reviewedForAccuracy` computed at
`page.tsx:59`, and a database CHECK that rejects a reviewer without a review
date. The badge cannot appear without a real review behind it, by design. Use
it, do not route around it.

Three pages have earned it today. The badge is the output of the sourcing pass
on the other 52, not a substitute for it.

## Recommended order

1. **Strip the fabrications** from `best-neighborhoods-panama-city-expats`.
   Cannot be done from this repo: the body lives in Supabase and no credentials
   are checked in, correctly. Needs the service-role key or a hand edit.
2. **Sourcing pass on the 52**, prioritised by the rescue order in
   `15-content-plan-2026-08-01.md`. Badge each page as it passes.
3. **Then** the rescue rewrites. The scope call for
   `best-neighborhoods-panama-city-expats` is settled and recorded in doc 15:
   it stays city-level, and the country-level intent gets its own page.

Two smaller items to fold into the pass rather than schedule separately: move
the WhatsApp CTA out of body content on 47 pages, and populate the structured
`faqs` field on the 22 pages that currently keep their FAQs as body markdown and
therefore emit no FAQPage schema.
