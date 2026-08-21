import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { usd, toPlainText } from "@/lib/content";
import { listAreas, getArea, getProjectsForArea } from "@/lib/catalog";
import { getAreaEditorialFull } from "@/lib/editorial";
import { alternatesForArea } from "@/lib/alternates";
import { AreaDetail } from "@/components/area-detail";

export const revalidate = 60;

/* =============================================================================
   /de/regionen/[slug]
   =============================================================================
   The English twin of this file renders the same <AreaDetail>. Everything that
   differs is passed in, which is the point of extracting it: there is no second
   copy of the markup to drift.

   `listAreas("de")` already filters to areas with a published translation, so
   generateStaticParams enumerates exactly the German pages that exist. Anything
   else 404s through getAreaEditorialFull returning null — never an English
   fallback, per the rule E1 set for articles.
   ============================================================================= */

export async function generateStaticParams() {
  return (await listAreas("de")).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = await getArea(slug, "de");
  if (!area) return {};

  const hasProjects = area.projectCount > 0 && area.priceFromUsd;
  const title = hasProjects
    ? `${area.name}: Immobilienpreise und Projekte im Vergleich`
    : `${area.name}: Kosten, Titelstatus und für wen es passt`;
  const description = hasProjects
    ? `${area.projectCount} Projekte in ${area.name}, ${area.region}, ab ${usd(area.priceFromUsd)}. Was das Leben dort kostet, wie das Grundstück geführt wird und für wen die Region passt.`
    : `${area.name}, ${area.region}: was das Leben dort kostet, wie die Grundstücke geführt werden, für wen die Region passt und was Sie vor einem Kauf prüfen sollten.`;

  return {
    title: { absolute: title },
    description,
    alternates: await alternatesForArea(slug, "de"),
    openGraph: {
      title,
      description,
      url: `/de/regionen/${slug}`,
      type: "website",
    },
  };
}

export default async function GermanAreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = await getArea(slug, "de");
  if (!area) notFound();

  const editorial = await getAreaEditorialFull(slug, "de");
  /* An area row without a published German translation is not a German page.
     getArea already filtered on that, so this is belt and braces — but it is
     the difference between 404 and silently serving English prose. */
  if (!editorial) notFound();

  const [areaProjects, areas] = await Promise.all([
    getProjectsForArea(slug),
    listAreas("de"),
  ]);

  const areaFaqs = editorial.faqs;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: area.name,
        url: `https://panamarealestateguide.com/de/regionen/${slug}`,
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
          {
            "@type": "ListItem",
            position: 1,
            name: "Start",
            item: "https://panamarealestateguide.com/de",
          },
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
        locale="de"
      />
    </>
  );
}
