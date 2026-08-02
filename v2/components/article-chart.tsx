/* =============================================================================
   Article chart
   =============================================================================
   Charts inside a guide body, authored as a ```chart fenced block holding JSON:

     ```chart
     {
       "caption": "Qualified Investor minimum by route",
       "note": "Decreto Ejecutivo 193 de 2024, art. 3 · checked August 2026",
       "unit": "usd",
       "rows": [
         { "label": "Real estate", "value": 300000 },
         { "label": "Securities",  "value": 500000 }
       ]
     }
     ```

   Why a fenced block rather than inline SVG or an uploaded image:

   - The body renders through ReactMarkdown with no rehype-raw, so raw HTML and
     SVG in the markdown are stripped. Adding rehype-raw to render our own
     charts would open every article body to arbitrary HTML for one feature.
   - An uploaded PNG puts the numbers in a binary nobody can check, which is the
     opposite of this site's whole proposition. Here the figures stay legible in
     the source, so a chart can be audited the same way a sentence can.
   - It degrades honestly. An older renderer shows the JSON rather than a broken
     image reference, which is exactly the failure the 20 orphan captions were.

   Form: one measure, one series, magnitude. Horizontal bars anchored at zero,
   every bar direct-labelled so the value never depends on reading a colour, no
   gridlines, no legend, no axis. Same idiom as EntryPriceChart, deliberately —
   two chart languages on one site is one too many.

   Colour #1B7FA8: the brand navy fails as a data fill (reads as ink), so this is
   the same family stepped into the usable band. Validated light-mode: lightness
   band, chroma floor, contrast ≥ 3:1 against the article surface.
   ============================================================================= */

type ChartRow = { label: string; value: number };
export type ChartSpec = {
  caption?: string;
  note?: string;
  unit?: "usd" | "pct" | "raw";
  rows: ChartRow[];
  /** Keep author order instead of sorting by magnitude. Use when the rows are a
      sequence (months, process steps) rather than a ranking. */
  keepOrder?: boolean;
};

const FILL = "#1B7FA8";

function format(value: number, unit: ChartSpec["unit"]) {
  if (unit === "pct") return `${value}%`;
  if (unit === "usd") {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
    if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1000)}k`;
    return `$${value.toLocaleString("en-US")}`;
  }
  return value.toLocaleString("en-US");
}

/** Returns null rather than throwing: a malformed chart must not take down the
    article around it. The raw block falls through to <pre> in that case. */
export function parseChartSpec(source: string): ChartSpec | null {
  try {
    const spec = JSON.parse(source) as ChartSpec;
    if (!Array.isArray(spec.rows) || spec.rows.length === 0) return null;
    if (!spec.rows.every((r) => typeof r?.label === "string" && Number.isFinite(r?.value))) return null;
    return spec;
  } catch {
    return null;
  }
}

export function ArticleChart({ spec }: { spec: ChartSpec }) {
  const rows = spec.keepOrder ? spec.rows : [...spec.rows].sort((a, b) => a.value - b.value);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)));

  return (
    <figure className="not-prose my-8 border-y border-line py-6">
      {spec.caption && (
        <figcaption className="font-display text-[15px] font-bold text-ink mb-5">
          {spec.caption}
        </figcaption>
      )}

      <ul className="flex flex-col gap-[7px] list-none p-0 m-0">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(88px,116px)_1fr] items-center gap-4 min-[560px]:grid-cols-[164px_1fr]">
            <span className="font-display text-[14px] font-semibold text-ink text-right leading-tight">
              {r.label}
            </span>
            <span className="flex items-center gap-3 min-w-0">
              {/* Track takes the row's remaining space after the nowrap value,
                  so pct is relative to what is actually available. Sizing the
                  bar against the whole row blows the layout out on mobile. */}
              <span className="flex-1 min-w-0 h-[11px]">
                <span
                  aria-hidden
                  className="block h-full rounded-r-[4px]"
                  style={{ width: `${max ? (Math.abs(r.value) / max) * 100 : 0}%`, backgroundColor: FILL }}
                />
              </span>
              <span className="font-mono text-[12.5px] tnum text-body whitespace-nowrap shrink-0">
                {format(r.value, spec.unit)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {spec.note && (
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.077em] text-faint">
          {spec.note}
        </p>
      )}
    </figure>
  );
}
