import type { Metadata } from "next";
import Link from "next/link";
import { usd } from "@/lib/content";
import { listAreas, listProjects } from "@/lib/catalog";
import { ProjectSearch } from "@/components/project-search";

export const revalidate = 60;

// The counts come from the catalogue, so the metadata has to be generated
// rather than declared. Areas that actually hold published inventory: three of
// the eighteen we track have none, and counting those would overstate it.
export async function generateMetadata(): Promise<Metadata> {
  const [projects, areas] = await Promise.all([listProjects(), listAreas()]);
  const stocked = areas.filter((a) => a.projectCount > 0).length;
  const entry = Math.min(
    ...projects.map((p) => p.priceFromUsd ?? Infinity).filter(Number.isFinite),
  );
  return {
    title: { absolute: `${projects.length} New Developments for Sale in Panama` },
    description: `Browse ${projects.length} residential developments across ${stocked} areas of Panama, from ${usd(entry)}. Filter by area, price and build status.`,
    alternates: { canonical: "/projects" },
  };
}

export default async function ProjectsPage() {
  const [projects, areas] = await Promise.all([listProjects(), listAreas()]);
  const stocked = areas.filter((a) => a.projectCount > 0).length;
  const entry = Math.min(
    ...projects.map((p) => p.priceFromUsd ?? Infinity).filter(Number.isFinite),
  );
  return (
    <>
      <section className="hero-band">
        <div className="wrap py-[clamp(32px,4.5vw,52px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/" className="text-white/70 underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">Projects</span>
          </nav>

          <h1 className="h1-article !text-white max-w-[22ch]">
            New developments for sale in Panama
          </h1>
          <p className="dek !text-white/90 mt-4 max-w-[62ch]">
            {projects.length} projects across {stocked} areas, from{" "}
            {usd(entry)}. Every price here comes from the developer — we tell
            you what has been checked and what has not.
          </p>
        </div>
      </section>

      <ProjectSearch projects={projects} areas={areas} />
    </>
  );
}
