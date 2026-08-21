import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { usd, statusLabel, toPlainText } from "@/lib/content";
import { listProjects, getProject, getArea, getProjectsForArea } from "@/lib/catalog";
import { getProjectEditorial } from "@/lib/editorial";
import { alternatesForProject } from "@/lib/alternates";
import { ProjectDetail } from "@/components/project-detail";
import { mediaUrl, absoluteMedia } from "@/lib/media";

/* =============================================================================
   Project detail — built to rank for the project's own name
   =============================================================================
   Someone searching "Pino Alto Boquete" wants four things: what it costs, what
   the units are, where it is, and when it delivers. Every H2 answers one of
   them, in that order, so the page matches the query intent rather than
   burying it under marketing copy.

   SEO structure carried here:
   · H1 is the project name verbatim — the exact keyword, once.
   · Per-project title, description, canonical, and OG image. v1 shipped ONE
     shared og:image across all 84 articles, pointing at a file not even in the
     repo. Each project uses its own first photograph.
   · JSON-LD: RealEstateListing wrapping an AggregateOffer with the real
     low/high price and unit count, plus BreadcrumbList.
   · The unit-model table is genuinely unique content no competitor has, which
     matters because it is the only substantial text on the page until the
     descriptions are rewritten.

   ⚠️ CONTENT GAP: Descripción EN in Airtable is v1's SEO-spam prose and is
   deliberately not rendered. Until real copy exists these pages are thin, and
   thin pages do not rank no matter how good the markup is.
   ============================================================================= */

export const revalidate = 60;

export async function generateStaticParams() {
  return (await listProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return {};
  const area = await getArea(p.areaSlug);
  const where = area ? `${area.name}, Panama` : "Panama";

  // Most project names already carry the area ("Pino Alto Boquete"), so only
  // append it when it is genuinely missing. Repeating it pushed titles past
  // 100 characters and Google truncated the tail.
  const areaSuffix =
    area && !p.name.toLowerCase().includes(area.name.toLowerCase())
      ? `, ${area.name}`
      : "";

  return {
    // Absolute, so the layout's "| Panama Real Estate Guide" suffix is not
    // appended. On a page whose whole job is ranking for the project's own
    // name, 26 characters of branding is 26 characters of truncation risk.
    title: { absolute: `${p.name}${areaSuffix} — prices & floor plans` },
    // A project we hold no verified price for says so rather than rendering
    // "from —", which reads as a broken template in a search result.
    description: p.priceFromUsd
      ? `${p.name} in ${where}. ${p.models.length} unit type${p.models.length === 1 ? "" : "s"} from ${usd(p.priceFromUsd)}${p.status ? `, ${statusLabel[p.status].toLowerCase()}` : ""}. Prices as listed by the developer.`
      : `${p.name} in ${where}${p.status ? `, ${statusLabel[p.status].toLowerCase()}` : ""}. We hold no independently verified pricing for this project.`,
    /* Reciprocal with /de/projekte/[slug]; both trees call this. */
    alternates: await alternatesForProject(p.slug, "en"),
    openGraph: {
      title: `${p.name} — ${where}`,
      description: p.priceFromUsd
        ? `${p.models.length} unit types from ${usd(p.priceFromUsd)}.`
        : `No independently verified pricing.`,
      url: `/projects/${p.slug}`,
      type: "website",
      images: p.photos[0] ? [{ url: mediaUrl(p.photos[0].src)! }] : undefined,
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) notFound();

  const editorial = await getProjectEditorial(slug);
  const area = await getArea(p.areaSlug);
  const siblings = (await getProjectsForArea(p.areaSlug))
    .filter((x) => x.slug !== p.slug)
    .slice(0, 3);

  const prices = p.models
    .map((m) => m.priceFromUsd)
    .filter((n): n is number => typeof n === "number");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateListing",
        name: p.name,
        url: `https://panamarealestateguide.com/projects/${p.slug}`,
        image: p.photos.map(
          (ph) => absoluteMedia(ph.src),
        ),
        ...(area && {
          address: {
            "@type": "PostalAddress",
            addressLocality: area.name,
            addressRegion: area.region,
            addressCountry: "PA",
          },
        }),
        ...(p.priceFromUsd && {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: p.priceFromUsd,
            ...(p.priceToUsd && { highPrice: p.priceToUsd }),
            offerCount: p.models.length || 1,
          },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://panamarealestateguide.com/" },
          { "@type": "ListItem", position: 2, name: "Projects", item: "https://panamarealestateguide.com/projects" },
          { "@type": "ListItem", position: 3, name: p.name },
        ],
      },
      ...(editorial && editorial.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: editorial.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: toPlainText(f.a) },
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
      <ProjectDetail
        project={p}
        editorial={editorial}
        area={area}
        siblings={siblings}
      />
    </>
  );
}
