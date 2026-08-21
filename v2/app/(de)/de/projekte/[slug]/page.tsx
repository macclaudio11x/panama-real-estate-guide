import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { usd, toPlainText } from "@/lib/content";
import { listProjects, getProject, getArea, getProjectsForArea } from "@/lib/catalog";
import { getProjectEditorial } from "@/lib/editorial";
import { alternatesForProject } from "@/lib/alternates";
import { statusLabelFor } from "@/lib/i18n";
import { ProjectDetail } from "@/components/project-detail";
import { mediaUrl, absoluteMedia } from "@/lib/media";

export const revalidate = 60;

/* =============================================================================
   /de/projekte/[slug]
   =============================================================================
   Renders the same <ProjectDetail> as the English route; only the inputs
   differ. `listProjects("de")` filters to projects with a published German
   translation, so generateStaticParams enumerates exactly the pages that exist.

   Note the URL segment: `projekte`, not `projects`. netlify.toml still 410s
   `/de/projects/*` as one of the four dead prefixes from the withdrawn tree,
   and the two differ by two characters. Do not "correct" this to the English
   spelling.
   ============================================================================= */

export async function generateStaticParams() {
  return (await listProjects("de")).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug, "de");
  if (!p) return {};

  const area = await getArea(p.areaSlug, "de");
  const where = area ? `${area.name}, Panama` : "Panama";
  const status = statusLabelFor("de", p.status);

  const title = `${p.name}: Preise, Grundrisse und was zu prüfen ist`;
  const description = p.priceFromUsd
    ? `${p.name} in ${where}. ${p.models.length} Wohnungstyp${p.models.length === 1 ? "" : "en"} ab ${usd(p.priceFromUsd)}${status ? `, ${status.toLowerCase()}` : ""}. Preise laut Angaben des Bauträgers.`
    : `${p.name} in ${where}${status ? `, ${status.toLowerCase()}` : ""}. Für dieses Projekt liegt uns kein unabhängig geprüfter Preis vor.`;

  return {
    title: { absolute: title },
    description,
    alternates: await alternatesForProject(slug, "de"),
    openGraph: {
      title,
      description,
      url: `/de/projekte/${slug}`,
      type: "website",
      images: p.photos[0] ? [{ url: mediaUrl(p.photos[0].src)! }] : undefined,
    },
  };
}

export default async function GermanProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProject(slug, "de");
  if (!p) notFound();

  const editorial = await getProjectEditorial(slug, "de");
  /* Belt and braces: getProject already filtered on a published translation,
     but this is the line between 404 and quietly serving English prose under a
     German URL. */
  if (!editorial) notFound();

  const area = await getArea(p.areaSlug, "de");
  const siblings = (await getProjectsForArea(p.areaSlug, "de"))
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
        url: `https://panamarealestateguide.com/de/projekte/${p.slug}`,
        ...(p.photos[0] && { image: [absoluteMedia(p.photos[0].src)] }),
        ...(prices.length > 0 && {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: p.models.length,
          },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Start",
            item: "https://panamarealestateguide.com/de",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Projekte",
            item: "https://panamarealestateguide.com/de/projekte",
          },
          { "@type": "ListItem", position: 3, name: p.name },
        ],
      },
      ...(editorial.faqs.length > 0
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
        locale="de"
      />
    </>
  );
}
