import type { Metadata } from "next";
import Link from "next/link";
import { usd } from "@/lib/content";
import { listAreas, listProjects } from "@/lib/catalog";
import { titleLabelFor, ui } from "@/lib/i18n";
import { alternatesForSection } from "@/lib/alternates";
import { AreaCard } from "@/components/area-card";
import { SourceNote } from "@/components/ui";

export const revalidate = 60;

const t = ui("de");

/* =============================================================================
   /de/regionen — the German areas index
   =============================================================================
   Lists only areas with a PUBLISHED German translation. `listAreas("de")` does
   that filtering, so this page cannot link to a URL that 404s and cannot show a
   card with German chrome wrapped around English prose.

   That also means this page is empty until the first area is translated, which
   is why `areas` is not in LIVE_SECTIONS.de yet: the header must not link here
   before there is something to see. Turning it on is a one-line change in
   lib/i18n.ts once P2 lands its first page.
   ============================================================================= */

export const metadata: Metadata = {
  title: { absolute: "Regionen in Panama im Vergleich — wo kaufen?" },
  description:
    "Einstiegspreise, Angebot und Titelstatus für jede Region Panamas, die wir geprüft haben. Von Panama-Stadt über Boquete bis an die Pazifikküste.",
  alternates: alternatesForSection("/areas", "de"),
};

export default async function GermanAreasPage() {
  const [areas, projects] = await Promise.all([listAreas("de"), listProjects()]);

  const entry = areas
    .map((a) => a.priceFromUsd)
    .filter((p): p is number => typeof p === "number");

  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,68px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/de" className="text-white/70 underline">
              {t.home}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{t.navAreas}</span>
          </nav>

          <h1 className="h1-article !text-white max-w-[18ch]">
            Wo in Panama kaufen
          </h1>
          <p className="dek !text-white/90 mt-5 max-w-[62ch]">
            {areas.length === 0
              ? "Die deutschen Regionsseiten entstehen gerade. Sobald eine Region geprüft und übersetzt ist, steht sie hier."
              : `${areas.length} Regionen, ${projects.length} Projekte. Der Preis ist dabei die am wenigsten wichtige Spalte: entscheidend ist, wie das Grundstück im Registro Público geführt wird.`}
          </p>
        </div>
      </section>

      {areas.length > 0 && (
        <>
          {/* ── Comparison table ──────────────────────────────────────────── */}
          <section className="py-[clamp(44px,6vw,72px)]">
            <div className="wrap">
              <h2 className="h2-section max-w-[24ch]">Nebeneinander</h2>
              <p className="dek mt-4 max-w-[62ch]">
                Nach Einstiegspreis sortiert. Der Titelstatus gehört an den
                Anfang Ihrer Auswahl, nicht ans Ende: er entscheidet, ob eine
                Bank das Objekt überhaupt finanziert.
              </p>

              <div className="mt-8 overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse text-[15.5px] min-w-[760px]">
                  <thead>
                    <tr>
                      {["Region", "Gebiet", "Ab Preis", "Titelstatus", "Projekte"].map(
                        (h) => (
                          <th
                            key={h}
                            className="bg-white font-display text-[14.5px] font-bold text-left text-ink border-b-2 border-brand-800 whitespace-nowrap px-4 py-3.5"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...areas]
                      .sort(
                        (a, b) =>
                          (a.priceFromUsd ?? Infinity) -
                          (b.priceFromUsd ?? Infinity),
                      )
                      .map((a) => (
                        <tr key={a.slug} className="hover:bg-paper-warm">
                          <td className="border-t border-line-soft px-4 py-3.5 font-semibold text-ink">
                            <Link
                              href={`/de/regionen/${a.slug}`}
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
                            {titleLabelFor("de", a.titleStatus)}
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
                <SourceNote>{t.pricesAsListed}</SourceNote>
              </div>

              {entry.length > 0 && (
                <p className="mt-6 text-[15px] leading-relaxed text-muted max-w-[62ch]">
                  Die Einstiegspreise beginnen bei {usd(Math.min(...entry))}. Sie
                  stammen aus den Angaben der Bauträger, nicht aus einem
                  amtlichen Index: Panama veröffentlicht keinen.
                </p>
              )}
            </div>
          </section>

          {/* ── Cards ─────────────────────────────────────────────────────── */}
          <section className="bg-paper-warm border-y border-line py-[clamp(56px,7vw,88px)]">
            <div className="wrap">
              <h2 className="h2-section max-w-[24ch]">Jede Region im Detail</h2>
              <div className="mt-10 grid gap-6 min-[640px]:grid-cols-2 min-[1040px]:grid-cols-3">
                {areas.map((area) => (
                  <AreaCard key={area.slug} area={area} locale="de" />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
