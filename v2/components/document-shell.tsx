import type { Metadata } from "next";
import { Figtree, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import type { PageLocale } from "@/lib/i18n";
import "@/app/globals.css";

/* The document itself, shared by every root layout.

   There is no `app/layout.tsx` any more. `<html>` lives in a root layout and a
   server layout cannot read the pathname, so a single root could only ever
   hardcode one `lang` — which is how the German tree came to inherit
   `lang="en"`. The fix is one root layout per route group, each rendering this
   component with its own locale. Everything those roots genuinely share (the
   fonts, the stylesheet, the Typekit link, `metadataBase`) lives here so it is
   still edited in one place.

   Cost: navigating between route groups is a full page load rather than a
   client-side transition. That only happens on a language switch, and it is
   the price of a correct `lang` attribute. */

// Display — geometric humanist, the closest freely-licensable face to
// sofia-pro (Adobe Fonts, which can't be self-hosted). Generous apertures and
// a tall x-height, so it holds up at 54px/700 with tight negative tracking.
// Deliberately not a grotesque: those read newsy and generic at display sizes.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

// Body — the readability engine. 17px/1.65 at a 720px measure.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

// Mono — carries every verification stamp and tabular figure. Mono is what
// makes "this number was checked" legible at a glance.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* Spread into each root layout's own `metadata`. Only what is genuinely
   locale-independent belongs here: the title template and description are
   site copy and have to be written per language. */
export const documentMetadata: Metadata = {
  metadataBase: new URL("https://panamarealestateguide.com"),
};

export function DocumentShell({
  lang,
  children,
}: {
  /** Becomes `<html lang>`. English is a page locale, not a translation tree. */
  lang: PageLocale;
  children: React.ReactNode;
}) {
  return (
    <html
      lang={lang}
      className={`${figtree.variable} ${sourceSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* sofia-pro via Adobe Fonts — what EasyStreetCap actually uses.
            Licensed through Charles's Typekit kit, so it can't be self-hosted
            the way next/font does; Figtree stays as the fallback in the stack
            if the kit fails to load or the domain isn't authorised. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="" />
        <link rel="stylesheet" href="https://use.typekit.net/fot0mck.css" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
