import type { MetadataRoute } from "next";
import { categories } from "@/lib/content";
import { listAreas, listProjects } from "@/lib/catalog";
import { listArticles } from "@/lib/articles";
import { hreflang, localePath } from "@/lib/i18n";
import {
  enArticlePath,
  listTranslationPairs,
  localeArticlePath,
} from "@/lib/alternates";

const SITE_BASE = "https://panamarealestateguide.com";

/* Revalidated so a newly published article appears in the sitemap without a
   deploy, matching the routes themselves. */
export const revalidate = 60;

/* =============================================================================
   The alternates in here must agree with the ones the pages emit
   =============================================================================
   Google cross-checks the two and treats a disagreement as a reason to trust
   neither. So the sections are paired by the same rule lib/alternates.ts uses
   and the articles are paired from the same query, rather than by rebuilding
   the relationship from a second set of assumptions.

   Every /de/ URL written here has to resolve 200. The stopgap 301s live under
   the same prefix, so this file is one of the places §4's "check every new
   German URL against netlify.toml" bites.
   ============================================================================= */

/** English + every locale that has this path, keyed by bare language code,
 *  with x-default on English. Sections only — see lib/alternates.ts. */
function sectionLanguages(enPath: string): Record<string, string> {
  /* Matches lib/alternates.ts exactly, trailing slash included — see the note
     on `abs` there for why the home page is the bare origin. */
  const enUrl = enPath === "/" ? SITE_BASE : `${SITE_BASE}${enPath}`;
  return {
    [hreflang.en]: enUrl,
    "x-default": enUrl,
    de: `${SITE_BASE}${localePath("de", enPath)}`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pairs = await listTranslationPairs();

  /* Home, the four category indexes and the contact form exist in both trees.
     Areas, projects and /about are English-only and get no alternates. */
  const paired: MetadataRoute.Sitemap = [
    { url: SITE_BASE, changeFrequency: "daily" as const, priority: 1.0 },
    ...categories.map((c) => ({
      url: `${SITE_BASE}/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_BASE}/contact`, changeFrequency: "monthly" as const, priority: 0.6 },
  ].map((entry) => {
    const enPath = entry.url.slice(SITE_BASE.length) || "/";

    return { ...entry, alternates: { languages: sectionLanguages(enPath) } };
  });

  /* Their German counterparts, as their own entries. A sitemap describes URLs,
     and /de/kaufen is a different URL from /buying carrying the same cluster. */
  const germanSections: MetadataRoute.Sitemap = [
    { path: "/", changeFrequency: "daily" as const, priority: 0.9 },
    ...categories.map((c) => ({
      path: `/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.5 },
  ].map(({ path, ...rest }) => ({
    url: `${SITE_BASE}${localePath("de", path)}`,
    ...rest,
    alternates: { languages: sectionLanguages(path) },
  }));

  const articleRoutes: MetadataRoute.Sitemap = (await listArticles()).map((a) => {
    const mine = pairs.filter(
      (p) => p.categorySlug === a.categorySlug && p.enSlug === a.slug,
    );
    const enUrl = `${SITE_BASE}${enArticlePath(a.categorySlug, a.slug)}`;
    /* No translation, no `alternates` key at all. An article that stands alone
       should say nothing about languages rather than name itself. */
    const languages = mine.length
      ? {
          [hreflang.en]: enUrl,
          "x-default": enUrl,
          ...Object.fromEntries(
            mine.map((p) => [
              hreflang[p.lang],
              `${SITE_BASE}${localeArticlePath(p.lang, p.categorySlug, p.localSlug)}`,
            ]),
          ),
        }
      : null;

    return {
      url: enUrl,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      ...(languages && { alternates: { languages } }),
    };
  });

  /* Translated articles, each with the same cluster its English source names. */
  const translatedRoutes: MetadataRoute.Sitemap = pairs.map((p) => {
    const enUrl = `${SITE_BASE}${enArticlePath(p.categorySlug, p.enSlug)}`;
    const siblings = pairs.filter(
      (q) => q.categorySlug === p.categorySlug && q.enSlug === p.enSlug,
    );
    return {
      url: `${SITE_BASE}${localeArticlePath(p.lang, p.categorySlug, p.localSlug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      alternates: {
        languages: {
          [hreflang.en]: enUrl,
          "x-default": enUrl,
          ...Object.fromEntries(
            siblings.map((q) => [
              hreflang[q.lang],
              `${SITE_BASE}${localeArticlePath(q.lang, q.categorySlug, q.localSlug)}`,
            ]),
          ),
        },
      },
    };
  });

  const areaRoutes: MetadataRoute.Sitemap = (await listAreas()).map((a) => ({
    url: `${SITE_BASE}/areas/${a.slug}`,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const projectRoutes: MetadataRoute.Sitemap = (await listProjects()).map((p) => ({
    url: `${SITE_BASE}/projects/${p.slug}`,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  return [
    ...paired,
    ...germanSections,
    ...articleRoutes,
    ...translatedRoutes,
    ...areaRoutes,
    ...projectRoutes,
  ];
}
