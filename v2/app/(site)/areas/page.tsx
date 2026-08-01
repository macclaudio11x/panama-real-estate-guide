import type { Metadata } from "next";
import Link from "next/link";
import { areas, projects, usd, titleLabel } from "@/lib/content";
import { AreaCard } from "@/components/area-card";
import { SourceNote } from "@/components/ui";

export const metadata: Metadata = {
  title: "Where to buy in Panama — every area compared",
  description:
    "Entry price, inventory, and title status for every Panama area we track, from Costa del Este and Santa María to Boquete, Playa Venao, and Portobelo.",
};

export default function AreasPage() {
  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,68px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/" className="text-white/70 underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">Areas</span>
          </nav>

          <h1 className="h1-article !text-white max-w-[18ch]">
            Where to buy in Panama
          </h1>
          <p className="dek !text-white/90 mt-5 max-w-[62ch]">
            {areas.length} areas, {projects.length} developments. Entry prices
            run from {usd(Math.min(...areas.map((a) => a.priceFromUsd ?? Infinity)))}{" "}
            in the city to well over a million on the coast — but price is the
            least important column here.
          </p>
        </div>
      </section>

      {/* ── Comparison table — the most linkable asset on the page ───────── */}
      <section className="py-[clamp(44px,6vw,72px)]">
        <div className="wrap">
          <h2 className="h2-section max-w-[24ch]">Side by side</h2>
          <p className="dek mt-4 max-w-[62ch]">
            Sorted by entry price. Title status is the column that should decide
            your shortlist — and it is the one column we have not filled in yet.
          </p>

          <div className="mt-8 overflow-x-auto rounded-md border border-line">
            <table className="w-full border-collapse text-[15.5px] min-w-[760px]">
              <thead>
                <tr>
                  {[
                    "Area",
                    "Region",
                    "Entry price",
                    "Title status",
                    "Projects",
                  ].map((h) => (
                    <th
                      key={h}
                      className="bg-white font-display text-[14.5px] font-bold text-left text-ink border-b-2 border-brand-800 whitespace-nowrap px-4 py-3.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...areas]
                  .sort(
                    (a, b) =>
                      (a.priceFromUsd ?? Infinity) - (b.priceFromUsd ?? Infinity),
                  )
                  .map((a) => (
                    <tr key={a.slug} className="hover:bg-paper-warm">
                      <td className="border-t border-line-soft px-4 py-3.5 font-semibold text-ink">
                        <Link
                          href={`/areas/${a.slug}`}
                          className="text-link no-underline hover:underline"
                        >
                          {a.name}
                        </Link>
                      </td>
                      <td className="border-t border-line-soft px-4 py-3.5 text-muted">
                        {a.region}
                      </td>
                      <td className="border-t border-line-soft px-4 py-3.5 font-mono tnum text-body">
                        {usd(a.priceFromUsd)}
                      </td>
                      <td
                        className={`border-t border-line-soft px-4 py-3.5 ${
                          a.titleStatus === "titled"
                            ? "font-semibold text-positive"
                            : a.titleStatus === "rop"
                              ? "font-semibold text-negative"
                              : a.titleStatus === "mixed"
                                ? "font-semibold text-accent-700"
                                : "text-faint italic"
                        }`}
                      >
                        {titleLabel[a.titleStatus]}
                      </td>
                      <td className="border-t border-line-soft px-4 py-3.5 font-mono tnum text-muted">
                        {a.projectCount}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <SourceNote>
              Prices as listed by developers · Title status pending research
            </SourceNote>
          </div>
        </div>
      </section>

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      <section className="bg-paper-warm border-y border-line py-[clamp(56px,7vw,88px)]">
        <div className="wrap">
          <h2 className="h2-section max-w-[24ch]">Each area in detail</h2>
          <div className="mt-10 grid gap-6 min-[640px]:grid-cols-2 min-[1040px]:grid-cols-3">
            {areas.map((area) => (
              <AreaCard key={area.slug} area={area} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
