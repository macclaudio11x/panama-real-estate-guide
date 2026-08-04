import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areas, getArea, getProjectsForArea, usd } from "@/lib/content";
import { getAreaEditorialFull } from "@/lib/editorial";
import { Button, TitleBadge, SourceNote } from "@/components/ui";
import { ProjectCard } from "@/components/project-card";

export const revalidate = 60;

export function generateStaticParams() {
  return areas.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = getArea(slug);
  if (!area) return {};
  const title = `${area.name} property guide — prices, projects, title risk`;
  const description = `${area.projectCount} development${area.projectCount === 1 ? "" : "s"} in ${area.name}, ${area.region}, from ${usd(area.priceFromUsd)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/areas/${slug}` },
    openGraph: { title, description, url: `/areas/${slug}`, type: "website" },
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = getArea(slug);
  if (!area) notFound();

  const editorial = await getAreaEditorialFull(slug);
  const areaProjects = getProjectsForArea(slug);
  const positioning = editorial?.positioning ?? area.positioning;
  const titleStatus = editorial?.titleStatus ?? area.titleStatus;
  const titleNote = editorial?.titleNote ?? area.titleNote;

  const specs = [
    { k: "Entry price", v: usd(area.priceFromUsd) },
    { k: "Upper range", v: usd(area.priceToUsd) },
    { k: "Projects", v: String(area.projectCount) },
    area.elevationM != null
      ? { k: "Elevation", v: `${area.elevationM}m` }
      : null,
    area.climate ? { k: "Climate", v: area.climate } : null,
  ].filter((s): s is { k: string; v: string } => s !== null);

  const areaFaqs = editorial?.faqs ?? [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: area.name,
        url: `https://panamarealestateguide.com/areas/${slug}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: area.name,
          addressRegion: area.region,
          addressCountry: "PA",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://panamarealestateguide.com/" },
          { "@type": "ListItem", position: 2, name: area.name },
        ],
      },
      ...(areaFaqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: areaFaqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,68px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/" className="text-white/70 underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/areas" className="text-white/70 underline">
              Areas
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{area.name}</span>
          </nav>

          <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            {area.region}
          </p>
          <h1 className="h1-article !text-white max-w-[18ch]">{area.name}</h1>
          {positioning && (
            <p className="dek !text-white/90 mt-5 max-w-[62ch]">
              {positioning}
            </p>
          )}

          <hr className="border-0 h-px bg-accent/45 my-7" />

          {/* Hard specs, realtor.com style — surfaced immediately. */}
          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            {specs.map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/55">
                  {s.k}
                </dt>
                <dd className="font-display text-[21px] font-bold text-white tnum mt-1">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <SourceNote>Prices as listed by developers</SourceNote>
          </div>
        </div>
      </section>

      {/* ── Title risk — the first thing, every time ─────────────────────── */}
      <section className="py-[clamp(40px,5vw,64px)]">
        <div className="wrap">
          <div
            className={`rounded-md border-l-4 p-6 max-w-[76ch] ${
              titleStatus === "rop"
                ? "bg-negative-50 border-negative"
                : titleStatus === "mixed"
                  ? "bg-accent-50 border-star"
                  : titleStatus === "titled"
                    ? "bg-positive-50 border-positive"
                    : "bg-paper-warm border-line"
            }`}
          >
            <p className="font-display text-[14px] font-bold uppercase tracking-[0.077em] text-ink">
              Before you shortlist anything here
            </p>
            <div className="mt-3">
              <TitleBadge status={titleStatus} />
            </div>
            <p className="mt-3.5 text-[16px] leading-relaxed text-body max-w-[62ch] whitespace-pre-line">
              {titleNote ??
                `We have not yet checked whether land in ${area.name} is titled or held as Rights of Possession. Until we have, treat every listing here as unverified and ask the seller for a finca number before you pay anything.`}
            </p>
            <Link
              href="/buying/titled-vs-rights-of-possession"
              className="inline-block mt-4 font-semibold text-link no-underline hover:underline"
            >
              How to check which one you&rsquo;re being offered →
            </Link>
          </div>
        </div>
      </section>

      {/* ── What it costs to live here ────────────────────────────────────── */}
      {editorial?.costOfLivingNote && (
        <section className="py-[clamp(32px,4vw,52px)] border-t border-line">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">
              What it costs to live in {area.name}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-body max-w-[70ch] whitespace-pre-line">
              {editorial.costOfLivingNote}
            </p>
          </div>
        </section>
      )}

      {/* ── Who it suits, and who it doesn't ────────────────────────────── */}
      {(editorial?.suits || editorial?.drawbacks) && (
        <section className="py-[clamp(32px,4vw,52px)] border-t border-line">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">
              {`Who ${area.name} suits — and who it doesn’t`}
            </h2>
            {editorial.suits && (
              <p className="mt-5 text-[16px] leading-relaxed text-body max-w-[70ch] whitespace-pre-line">
                {editorial.suits}
              </p>
            )}
            {editorial.drawbacks && (
              <p className="mt-4 text-[16px] leading-relaxed text-body max-w-[70ch] whitespace-pre-line">
                {editorial.drawbacks}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Getting there and getting around ────────────────────────────── */}
      {editorial?.gettingAroundNote && (
        <section className="py-[clamp(32px,4vw,52px)] border-t border-line">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">
              Getting there and getting around
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-body max-w-[70ch] whitespace-pre-line">
              {editorial.gettingAroundNote}
            </p>
          </div>
        </section>
      )}

      {/* ── Projects — realtor.com listing mechanics ─────────────────────── */}
      <section className="bg-paper-warm border-y border-line py-[clamp(52px,7vw,80px)]">
        <div className="wrap">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="h2-section max-w-[24ch]">Projects in {area.name}</h2>
            <p className="font-mono text-[13px] text-muted tnum">
              {areaProjects.length} listed
            </p>
          </div>

          {areaProjects.length === 0 ? (
            <p className="mt-6 text-muted max-w-[60ch]">
              Nothing published here yet. Tell us what you&rsquo;re looking for
              and we&rsquo;ll send what&rsquo;s available off-listing.
            </p>
          ) : (
            <div className="mt-9 grid gap-6 min-[720px]:grid-cols-2 min-[1080px]:grid-cols-3">
              {areaProjects.map((p) => (
                <ProjectCard key={p.slug} project={p} area={area} />
              ))}
            </div>
          )}

          <div className="mt-5">
            <SourceNote>
              Prices as listed by developers ·{" "}
              {titleStatus === "unknown"
                ? "title status not yet checked"
                : "see title status above"}
            </SourceNote>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {editorial && editorial.faqs.length > 0 && (
        <section className="py-[clamp(48px,6vw,72px)]">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">FAQ</h2>
            <div className="mt-8 flex flex-col gap-3 max-w-[70ch]">
              {editorial.faqs.map((f, i) => (
                <div key={i} className="rounded-md border border-line p-5">
                  <p className="font-display text-[15.5px] font-bold text-ink">
                    {f.q}
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-body">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
            {editorial.sources.length > 0 && (
              <div className="max-w-[70ch] mt-10 border-t border-line pt-6">
                <p className="font-display text-[14px] font-bold uppercase tracking-[0.077em] text-ink">
                  Sources
                </p>
                <ol className="mt-3 text-[15px] space-y-1">
                  {editorial.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        rel="nofollow noopener"
                        target="_blank"
                        className="text-link no-underline hover:underline"
                      >
                        {s.label}
                      </a>
                      {s.checkedOn && (
                        <span className="text-faint"> — checked {s.checkedOn}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Lead capture ────────────────────────────────────────────────── */}
      <section className="py-[clamp(52px,7vw,80px)]">
        <div className="wrap">
          <div className="hero-band rounded-lg p-[clamp(26px,4vw,44px)] flex flex-wrap items-center justify-between gap-7">
            <div>
              <h2 className="font-display text-[clamp(22px,2.8vw,30px)] font-bold tracking-[-0.019em] text-white max-w-[24ch] leading-tight">
                Want the {area.name} shortlist with title status attached?
              </h2>
              <p className="mt-3 text-white/85 max-w-[54ch]">
                A broker will follow up. You&rsquo;ll get the paperwork status
                first.
              </p>
            </div>
            <Button href="/contact">Get the shortlist</Button>
          </div>
        </div>
      </section>

      {/* ── Nearby ──────────────────────────────────────────────────────── */}
      <section className="border-t border-line py-[clamp(40px,5vw,64px)]">
        <div className="wrap">
          <p className="eyebrow mb-4">Also in {area.region}</p>
          <div className="flex flex-wrap gap-2.5">
            {areas
              .filter((a) => a.region === area.region && a.slug !== area.slug)
              .map((a) => (
                <Link
                  key={a.slug}
                  href={`/areas/${a.slug}`}
                  className="rounded-full border border-line px-4 py-1.5 font-display text-[13.5px] font-semibold text-body no-underline hover:border-brand hover:text-brand transition-colors"
                >
                  {a.name}{" "}
                  <span className="text-faint tnum">({a.projectCount})</span>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
