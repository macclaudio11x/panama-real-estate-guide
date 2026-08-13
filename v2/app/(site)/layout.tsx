import type { Metadata } from "next";
import { DocumentShell, documentMetadata } from "@/components/document-shell";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StickyCta } from "@/components/sticky-cta";
import { GoogleAnalytics } from "@/components/google-analytics";
import { MetaPixel } from "@/components/meta-pixel";

/* The English site's root layout. It owns the document (via DocumentShell) and
   the public chrome. The group adds nothing to any URL: every public path here
   is unchanged, and `/` is defined inside it, which is what lets the app drop
   its top-level layout.tsx and still resolve a home route. Analytics sits here
   for the same reason the header does: it belongs to the public site, not to
   /admin. */

export const metadata: Metadata = {
  ...documentMetadata,
  title: {
    default: "Panama Real Estate Guide — Know what you're buying",
    template: "%s | Panama Real Estate Guide",
  },
  description:
    "Independent guides to buying property in Panama. Verified figures, titled-land checks, and area-by-area research for foreign buyers.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocumentShell lang="en">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {/* Mobile only, and it hides itself around forms and the footer. */}
      <StickyCta />
      <GoogleAnalytics />
      <MetaPixel />
    </DocumentShell>
  );
}
