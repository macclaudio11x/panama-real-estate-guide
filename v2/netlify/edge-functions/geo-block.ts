/* =============================================================================
   Geo block
   =============================================================================
   Refuses requests from countries that send us automated traffic and nothing
   else. Runs at the edge, before the Next.js function, so a blocked request
   costs one edge invocation and never reaches a route handler, the database,
   or Cloudflare's siteverify endpoint.

   Why this exists, and what it is not for.

   The lead form was never the problem. Every one of these submissions was
   already being caught by the honeypot in app/api/lead/route.ts, before
   validation and before Turnstile, so not one of them became a row. What they
   did do was pollute analytics: the honeypot answers with a 303 to
   /contact/thanks on purpose, so a bot cannot tell rejection from success, and
   the bot then loads that page and fires a GA page_view. Over 28 days that put
   75 fake views on the thanks page and made Iran the site's top country by
   pageviews, ahead of Panama. Conversion rate measured off that page was
   fiction.

   So this is an analytics-integrity measure and a cost measure, not a security
   one. The gates behind it stay exactly as they are, and still carry the load
   for everywhere not on this list.

   Deliberately narrow. Russia was looked at and left alone: 16 pageviews over
   the same period, against a genuine buyer segment for Panama property and
   second residency. Blocking a country costs real enquiries, so the bar is
   traffic that is demonstrably all automated.
   ============================================================================= */

/* Deno, not Node: this runs in Netlify's edge runtime, which resolves imports
   by URL. `next build` typechecks everything under v2/, and tsc cannot resolve
   a URL specifier, so tsconfig.json excludes this directory. Removing that
   exclusion fails the build with TS2307. */
import type { Context } from "https://edge.netlify.com";

/* ISO 3166-1 alpha-2. Keep this list short and keep the evidence with it:
   add a country only after confirming in GA that its traffic is automated. */
const BLOCKED = new Set(["IR"]);

export default async (request: Request, context: Context) => {
  const country = context.geo?.country?.code;

  /* Absent geo passes. Netlify resolves this on nearly every request, but a
     lookup that fails should not turn into a blanket outage. */
  if (country && BLOCKED.has(country)) {
    return new Response("This site is not available in your region.", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Never cache a block. A CDN entry keyed on path rather than country
        // would serve this 403 to everyone.
        "Cache-Control": "no-store",
      },
    });
  }

  return context.next();
};

/* Static assets are excluded because they cannot fire a page_view or reach the
   lead endpoint, so blocking them buys nothing and spends an invocation on
   every image the page pulls. */
export const config = {
  path: "/*",
  excludedPath: [
    "/_next/static/*",
    "/_next/image*",
    "/*.ico",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.svg",
    "/*.webp",
    "/*.avif",
    "/*.woff2",
  ],
};
