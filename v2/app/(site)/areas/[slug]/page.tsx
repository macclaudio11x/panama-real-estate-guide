import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { usd, toPlainText } from "@/lib/content";
import { listAreas, getArea, getProjectsForArea } from "@/lib/catalog";
import { getAreaEditorialFull } from "@/lib/editorial";
import { alternatesForArea } from "@/lib/alternates";
import { AreaDetail } from "@/components/area-detail";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await listAreas()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = await getArea(slug);
  if (!area) return {};
  // Absolute and inside ~60 characters including the longest area name, so the
  // layout's site-name suffix does not push the keyword out of the search
  // result. The old formula ended in "title risk", which led with the scariest
  // word on the page before the reader had seen anything they came for.
  //
  // Three areas currently carry no projects and no price. Promising "prices and
  // projects" there, or opening a search snippet with "Compare 0 developments",
  // advertises the emptiest thing about the page, so those get their own copy
  // built from what the page does answer.
  const hasProjects = area.projectCount > 0 && area.priceFromUsd;
  const title = hasProjects
    ? `${area.name} Real Estate: Prices and Projects Compared`
    : `${area.name} Real Estate: Costs, Title and Who It Suits`;
  const count = `${area.projectCount} development${area.projectCount === 1 ? "" : "s"}`;
  // The old description was one clause of about fifty characters, which left
  // most of the snippet empty. This spends the budget on what the page answers.
  const description = hasProjects
    ? `Compare ${count} in ${area.name}, ${area.region}, from ${usd(area.priceFromUsd)}. What it costs to live there, how the land is titled, and who the area suits.`
    : `${area.name}, ${area.region}: what it costs to live there, how the land is titled, who the area suits, and what to check before you buy property here.`;
  return {
    title: { absolute: title },
    description,
    /* Reciprocal with /de/regionen/[slug]: both sides call the same
       function and get the same map, so the pairing cannot go one-way. */
    alternates: await alternatesForArea(slug, "en"),
    openGraph: { title, description, url: `/areas/${slug}`, type: "website" },
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = await getArea(slug);
  if (!area) notFound();

  const editorial = await getAreaEditorialFull(slug);
  const [areaProjects, areas] = await Promise.all([
    getProjectsForArea(slug),
    listAreas(),
  ]);

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
      <AreaDetail
        area={area}
        editorial={editorial}
        areaProjects={areaProjects}
        areas={areas}
      />
    </>
  );
}
