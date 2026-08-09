# Page types

## Search metadata, on every page type

The routes emit the title **absolutely**, with no "| Panama Real Estate Guide"
suffix appended, so the whole budget belongs to the page.

- **`title`** — 60 characters maximum. It is the H1 and the search-result title
  at once. Primary keyword first, before the colon. "Boquete Real Estate:
  Prices, Title and Who It Suits" works. A title that opens with a subordinate
  clause and reaches the keyword in the ninth word does not.
- **`dek`** — 140 to 160 characters, and it must read as a complete thought on
  its own. It is doing three jobs: the standfirst under the headline, the copy
  on the listing card, and the meta description in search results. Under 140
  wastes the snippet; over 160 gets cut mid-sentence.

The linter warns on both, so check `lint_article` before you call the page done.
Neither is a gotcha or a debunk: the title and dek are the only part of the page
most people ever see, so they carry the same warmth as the body.

Three shapes. Each maps to a different search intent, so each has a different
skeleton. Read the one you are writing.

---

## Project pages — `/projects/{slug}`

**Intent:** someone typed the project name. They want the price, the units,
where it is, and whether it is a good idea. In that order.

Every H2 carries the project name so the page stays on-entity throughout.

### Section order

1. **Identity** — name, developer, architect, area, status, delivery, price
   range, unit count. Structured fields, not prose.
2. **The hook** — one paragraph. The specific thing that makes this different
   from the tower next door. This is the paragraph that stops the page reading
   like a syndicated listing.
3. **`{Name} prices and floor plans`** — the per-unit table. Beds, baths, m²,
   sq ft, price. No competitor publishes this; it is the strongest asset on the
   page.
4. **`Where {Name} actually is`** — context, not coordinates. What is walkable,
   how far to Tocumen, which supermarket, what the road in is like, what gets
   noisy. Links to the area page.
5. **`What's included at {Name}`** — full amenity list in English. Airtable's
   are in Spanish and need translating, not transliterating: "Golf Ejecutivo de
   9 Hoyos" is a 9-hole executive golf course.
6. **`Who {Name} suits — and who it doesn't`** — retirees vs investors vs
   families, climate, commute, resale risk. The section the brokers cannot
   write.
7. **`Before you buy at {Name}`** — title status, permits, developer delivery
   record, deposit structure, what an attorney should pull.
8. **FAQ** — 5–8 real questions, marked up as `FAQPage`.
9. Lead form and related projects (already built; no copy needed).

### Length

700+ words of original prose, excluding the table. Below that the page is thin
regardless of markup quality.

---

## Area pages — `/areas/{slug}`

**Intent:** someone is deciding *where*, not *what*. They are comparing Boquete
against Coronado against Costa del Este, and the honest answer is usually "it
depends who you are."

These are the SEO hub layer: every project and guide in an area links here, so
authority concentrates. They matter more long-term than any single project page.

### Section order

1. **Identity** — name, region, elevation, climate, price range, project count.
2. **Positioning** — one sentence on who ends up here and why. "Buyers come here
   to escape the heat without leaving the tropics" does more work than three
   paragraphs of scenery.
3. **`Is {Area} titled?`** — the title-risk position for the area, sourced. This
   is the highest-value section on any area page and the one nobody else writes.
4. **`What it costs to live in {Area}`** — real figures with sources.
5. **`Who {Area} suits — and who it doesn't`**.
6. **`Getting there and getting around`** — airport distance, road quality,
   whether a car is required.
7. **Projects grid** (already built).
8. **FAQ**.

### The trap

Area pages drift into travel writing. Nobody buying a $300k apartment needs a
paragraph about mist rolling over coffee farms. Every section answers a
purchase question or it comes out.

---

## Guides — `/{category}/{slug}`

Categories: `buying`, `residency`, `money`, `living`.

**Intent:** a procedural or comparative question. "How does closing work", "what
is the Friendly Nations visa", "titled vs Rights of Possession".

This is where the LeyConsulta-style article template applies, and where the
Casey Foster structure fits most directly.

### Section order

1. **Opening paragraph that leads with a number.** No throat-clearing. The
   reader's question starts getting answered in sentence one.
2. **Key Takeaways** — 4–6 bullets, each a complete claim, each carrying its
   source and check date inside the bullet.
3. **Body** — H2 per stage or per question. Tables for anything with more than
   three comparable values.
4. **Callouts** — three variants exist in the design system:
   - default: useful aside
   - `warn`: something that costs money if ignored
   - `legal`: a statute, registry, or authority citation
5. **`Which route fits you`** — the fit section. Match reader situations to
   the right option, including when a *different* option on our site is the
   better one ("if your income is documentary-heavy, the Pensionado route is
   simpler than Friendly Nations, here's that guide"). Honest routing is the
   differentiator; a section telling the reader not to come is not routing,
   it is a closed door, and it does not appear on this site.
6. **Sources** — numbered, full URLs, primary institutions only.
7. **FAQ**.
8. **Close with the next step** — one short paragraph bridging to the inquiry
   form: what we'd need from the reader (budget, timeline, situation) and
   what they get back. Never close on caveats or a list of unverified items.

### Reviewer requirement

Anything touching title, tax, or residency law needs a named reviewer with a
credential before it publishes. The database enforces this: an article with a
`reviewer_id` and no `reviewed_on` is rejected, so a "reviewed for accuracy"
badge cannot appear without a real review behind it.

---

## Cross-linking

Internal links are not decoration — v1 shipped 254,000 words with **zero**
working body links because the renderer never parsed markdown link syntax, and
that is a large part of why nothing ranked.

Every page links:

- **Project → area** (its own area, in the location section)
- **Project → guide** (title guide from the "before you buy" section)
- **Area → its projects**, and → the guides relevant to that area
- **Guide → area** wherever an area is named
- **Guide → guide** where a term is explained better elsewhere

Write links inline in prose. Do not append a "related reading" list — those get
ignored by readers and discounted by search engines.
