import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin is behind a login and every page under it is noindex, but a
    // disallow keeps crawlers from spending budget on a wall they can't pass.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/contact/thanks"] },
    sitemap: "https://panamarealestateguide.com/sitemap.xml",
  };
}
