import type { Metadata } from "next";
import { DocumentShell, documentMetadata } from "@/components/document-shell";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StickyCta } from "@/components/sticky-cta";
import { GoogleAnalytics } from "@/components/google-analytics";
import { MetaPixel } from "@/components/meta-pixel";

/* The German tree's root layout. Its only job beyond the English one is
   `lang="de"`: a server layout cannot read the pathname, so one root layout
   could only ever hardcode a single language, which is exactly how the
   withdrawn machine-translated tree came to serve German under `lang="en"`.

   `StickyCta` is here for the same reason it is on the English side: mobile is
   the breakpoint with the least to work with, and a third of sessions are
   mobile. It keeps its German general line rather than fetching the
   English-composed social-proof line — see the component. Analytics and the
   pixel are here because
   they belong to the public site in both languages; the German pages have to
   be measurable from the day they ship, since whether they hold the positions
   the old tree held is the entire experiment. */

export const metadata: Metadata = {
  ...documentMetadata,
  title: {
    default: "Panama Real Estate Guide — Wissen, was Sie kaufen",
    template: "%s | Panama Real Estate Guide",
  },
  description:
    "Unabhängige Ratgeber zum Immobilienkauf in Panama. Geprüfte Zahlen, Titelprüfung und Recherche vor Ort — auf Deutsch, für ausländische Käufer.",
};

export default function GermanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DocumentShell lang="de">
      <SiteHeader locale="de" />
      <main className="flex-1">{children}</main>
      <SiteFooter locale="de" />
      <StickyCta locale="de" />
      <GoogleAnalytics />
      <MetaPixel />
    </DocumentShell>
  );
}
