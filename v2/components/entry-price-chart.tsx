import Link from "next/link";
import { areas, usd } from "@/lib/content";

/* =============================================================================
   Entry price by area
   =============================================================================
   Answers the first question a foreign buyer actually has — "what can I afford,
   and where?" — from real synced inventory.

   Form: one measure (entry price), one series, so one hue. Magnitude bars
   anchored at zero, sorted ascending. No legend (a single series needs none —
   the heading names it), no gridlines, no chart chrome. Every bar is direct-
   labelled, so the value is never colour-dependent.

   Colour: #1B7FA8. The brand navy fails as a data fill — at L 0.40 / C 0.08 it
   reads as ink rather than data — so this is the same family stepped into the
   usable band. Validated: lightness, chroma, CVD separation, contrast.

   Deliberately NOT the from→to range: the top end spans 22× ($117.6k → $2.67M),
   which linear compresses into slivers and log makes dishonest for money. The
   full range lives on /areas, where a table can carry it properly.
   ============================================================================= */

export function EntryPriceChart() {
  const rows = [...areas]
    .filter((a) => a.priceFromUsd != null)
    .sort((a, b) => (a.priceFromUsd ?? 0) - (b.priceFromUsd ?? 0));

  const max = Math.max(...rows.map((r) => r.priceFromUsd ?? 0));
  const cheapest = rows[0];
  // Counted over the five cheapest specifically, because that is what the
  // sentence claims. Counting every Panama City area would make the line read
  // as a ranking finding when it is only a total.
  const cityInCheapestFive = rows
    .slice(0, 5)
    .filter((r) => r.region === "Panama City").length;

  return (
    <section className="border-y border-line bg-paper-warm py-[clamp(48px,6vw,76px)]">
      <div className="wrap">
        <div className="max-w-[62ch]">
          <p className="eyebrow mb-3.5">What it costs to get in</p>
          <h2 className="h2-section">
            The cheapest way into Panama is a city apartment, not a beach house
          </h2>
          <p className="dek mt-4">
            Entry prices across the {rows.length} areas we track start at{" "}
            {usd(cheapest.priceFromUsd)} in {cheapest.name}. {cityInCheapestFive}{" "}
            of the five cheapest are inside Panama City — every beachfront area
            costs more to enter than the capital does.
          </p>
        </div>

        <ul className="mt-10 flex flex-col gap-[7px]">
          {rows.map((a) => {
            const pct = ((a.priceFromUsd ?? 0) / max) * 100;
            return (
              <li key={a.slug}>
                <Link
                  href={`/areas/${a.slug}`}
                  className="group grid grid-cols-[minmax(96px,132px)_1fr] items-center gap-4 no-underline min-[560px]:grid-cols-[152px_1fr]"
                >
                  <span className="font-display text-[14.5px] font-semibold text-ink text-right truncate group-hover:text-brand transition-colors">
                    {a.name}
                  </span>

                  <span className="flex items-center gap-3 min-w-0">
                    {/* Track sized to the flex row's remaining space (after the
                        nowrap label), so the bar's pct% is relative to what's
                        actually available — not the whole row. Sizing the bar
                        directly against the row let a near-max pct push past
                        the label and blow out the row width on mobile. */}
                    <span className="flex-1 min-w-0 h-[11px]">
                      <span
                        aria-hidden
                        className="block h-full rounded-r-[4px] transition-opacity group-hover:opacity-80"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: "#1B7FA8",
                        }}
                      />
                    </span>
                    <span className="font-mono text-[12.5px] tnum text-body whitespace-nowrap shrink-0">
                      {usd(a.priceFromUsd)}
                      <span className="text-faint">
                        {" "}
                        · {a.projectCount}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.077em] text-faint">
          Lowest advertised price per area · trailing number is projects listed ·
          as listed by developers
        </p>
      </div>
    </section>
  );
}
