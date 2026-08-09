import type { MetadataRoute } from "next";
import { categories } from "@/lib/content";
import { listAreas, listProjects } from "@/lib/catalog";
import { listArticles } from "@/lib/articles";

const SITE_BASE = "https://panamarealestateguide.com";

/* Revalidated so a newly published article appears in the sitemap without a
   deploy, matching the routes themselves. */
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_BASE}/`, changeFrequency: "daily", priority: 1.0 },
    ...categories.map((c) => ({
      url: `${SITE_BASE}/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  const articleRoutes: MetadataRoute.Sitemap = (await listArticles()).map((a) => ({
    url: `${SITE_BASE}/${a.categorySlug}/${a.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

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

  return [...staticRoutes, ...articleRoutes, ...areaRoutes, ...projectRoutes];
}
