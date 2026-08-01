import type { Metadata } from "next";
import { Figtree, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/* The root layout is now only what every route shares: the document, the
   fonts, and the stylesheet. Site chrome moved to app/(site)/layout.tsx when
   /admin arrived — a broker's leads inbox has no business rendering the
   marketing header and a footer full of guide links. The (site) group is a
   naming device only; every public URL is unchanged. */

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

export const metadata: Metadata = {
  metadataBase: new URL("https://panamarealestateguide.com"),
  title: {
    default: "Panama Real Estate Guide — Know what you're buying",
    template: "%s | Panama Real Estate Guide",
  },
  description:
    "Independent guides to buying property in Panama. Verified figures, titled-land checks, and area-by-area research for foreign buyers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
