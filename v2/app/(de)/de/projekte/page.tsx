import type { Metadata } from "next";
import Link from "next/link";
import { usd } from "@/lib/content";
import { listAreas, listProjects } from "@/lib/catalog";
import { ui } from "@/lib/i18n";
import { alternatesForSection } from "@/lib/alternates";
import { ProjectSearch } from "@/components/project-search";

export const revalidate = 60;

const t = ui("de");

/* =============================================================================
   /de/projekte — the German projects index
   =============================================================================
   `listProjects("de")` returns only projects with a published German
   translation, so the filters, the counts and the cards all describe the German
   tree rather than the English one. An index that counted 40 and linked to 0
   would be worse than an empty one.

   The areas passed to <ProjectSearch> are the German ones too, because the
   region and area filters read from them and would otherwise offer filters that
   match nothing.

   `projects` stays out of LIVE_SECTIONS.de until the first project is
   translated, so the header does not link here while it is empty.
   ============================================================================= */

export async function generateMetadata(): Promise<Metadata> {
  const projects = await listProjects("de");
  return {
    title: {
      absolute:
        projects.length > 0
          ? `${projects.length} Neubauprojekte in Panama`
          : "Neubauprojekte in Panama",
    },
    description:
      "Neubauprojekte in Panama mit Preisen, Grundrissen und dem, was vor einem Kauf zu prüfen ist. Preise laut Angaben der Bauträger, mit Prüfdatum.",
    alternates: alternatesForSection("/projects", "de"),
  };
}

export default async function GermanProjectsPage() {
  const [projects, areas] = await Promise.all([
    listProjects("de"),
    listAreas("de"),
  ]);

  const stocked = areas.filter((a) => a.projectCount > 0).length;
  const entry = Math.min(
    ...projects.map((p) => p.priceFromUsd ?? Infinity).filter(Number.isFinite),
  );

  return (
    <>
      <section className="hero-band">
        <div className="wrap py-[clamp(32px,4.5vw,52px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/de" className="text-white/70 underline">
              {t.home}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{t.navProjects}</span>
          </nav>

          <h1 className="h1-article !text-white max-w-[22ch]">
            Neubauprojekte in Panama
          </h1>
          <p className="dek !text-white/90 mt-4 max-w-[62ch]">
            {projects.length === 0
              ? "Die deutschen Projektseiten entstehen gerade. Sobald ein Projekt geprüft und übersetzt ist, steht es hier."
              : `${projects.length} Projekte in ${stocked} Regionen, ab ${usd(entry)}. Jeder Preis hier stammt vom Bauträger. Wir sagen dazu, was geprüft ist und was nicht.`}
          </p>
        </div>
      </section>

      {projects.length > 0 && (
        <ProjectSearch projects={projects} areas={areas} locale="de" />
      )}
    </>
  );
}
