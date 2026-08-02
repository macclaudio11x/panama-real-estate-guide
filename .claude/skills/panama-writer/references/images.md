# Images and charts

Two different problems that get confused with each other. Decide which one you
have before reaching for a tool.

| Need | Answer |
|---|---|
| Show a comparison the reader should be able to check | A `chart` block. Data stays in the source. |
| Show a real place or building | Real photography, from Airtable via R2. Never generated. |
| Decorate a guide that has nothing to depict | Usually nothing. See "when not to". |

## Charts: the `chart` block

Charts are authored inside the article body as a fenced block. The renderer is
`v2/components/article-chart.tsx`, wired into ReactMarkdown at the `pre`
override in the article template.

    ```chart
    {
      "caption": "Qualified Investor residency: minimum by route",
      "note": "Decreto Ejecutivo 193 de 2024, art. 3 · checked August 2026",
      "unit": "usd",
      "rows": [
        { "label": "Real estate",   "value": 300000 },
        { "label": "Securities",    "value": 500000 },
        { "label": "Fixed deposit", "value": 750000 }
      ]
    }
    ```

| Field | Notes |
|---|---|
| `caption` | Optional. A claim, not a label. "Minimum by route" beats "Chart 1". |
| `note` | **Effectively required.** The source and the check date, same as any figure. |
| `unit` | `usd` (300000 → `$300k`), `pct`, or `raw`. |
| `rows` | `{label, value}`. Sorted ascending by default. |
| `keepOrder` | Set true when rows are a sequence (months, process steps), not a ranking. |

**Why a fenced block rather than an image or inline SVG.** The body renders
through ReactMarkdown with no `rehype-raw`, so raw HTML and SVG are stripped,
and adding `rehype-raw` would open every article body to arbitrary HTML for one
feature. More to the point, a PNG puts the numbers inside a binary nobody can
check, which is the opposite of what this site sells. Here the figures stay
legible in the source, so a chart can be audited the same way a sentence can.

**Form.** One measure, one series, horizontal magnitude bars, every bar
direct-labelled so the value never depends on reading a colour. No gridlines, no
axis, no legend. This is the same idiom as `EntryPriceChart` on the home page,
deliberately: two chart languages on one site is one too many.

**Colour** is fixed at `#1B7FA8` and is not a choice per chart. Brand navy fails
as a data fill, so this is the same family stepped into the usable band, and it
is validated for lightness, chroma and contrast against the article surface.

**A chart must not repeat a table.** If the same numbers already appear in a
table on the page, pick one. The chart earns its place when magnitude is the
point; the table earns it when the conditions attached to each row are the point.

## The rule that matters most

**Never generate a photorealistic image of a named real property, project, area
or building.** Not a hero shot, not a "representative" render, not an
illustration that could be mistaken for the place.

A synthesised picture of a real building presented as that building is the same
failure as a fabricated testimonial: an invented fact wearing the costume of
evidence. The site removed 40 articles' worth of invented advisors in August
2026 for exactly this reason. Do not reintroduce the problem in a format that is
harder to audit.

Project and area photography comes from Airtable, synced and served from R2. If
there is no photograph, the page shows no photograph.

## When not to add an image at all

Adding a picture because the page "needs one" is how the site ended up with 20
articles carrying captions for charts nobody ever drew. Those captions described
data ("Bocas leads at -52%") that had no source behind it, and they were removed
rather than illustrated, because drawing them would have published unverified
numbers with more authority rather than less.

So: no decorative stock imagery, and **no chart whose data you cannot source.**
If the number is not good enough to write in a sentence with a citation, it is
not good enough to draw.

## Outstanding

Twenty articles lost a chart caption in the 2026-08-02 cleanup. Each is a place
where a chart genuinely belongs, and each is blocked on the same thing: the
figures need a primary source first. Those charts come back during the sourcing
pass, not before. The list is in
`seo-strategy-2026/16-content-integrity-audit-2026-08-01.md`.
