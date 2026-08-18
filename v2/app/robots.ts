import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin is behind a login and every page under it is noindex, but a
    // disallow keeps crawlers from spending budget on a wall they can't pass.
    // Every locale's confirmation page, not just the English one: a German
    // conversion page in search results is the same problem in another
    // language. Extend this when a locale ships, or its thanks page indexes.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/contact/thanks", "/de/kontakt/danke"],
    },
    sitemap: "https://panamarealestateguide.com/sitemap.xml",
  };
}
