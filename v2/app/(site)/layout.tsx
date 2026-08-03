import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GoogleAnalytics } from "@/components/google-analytics";

/* Public-site chrome. Lifted out of the root layout so /admin can render its
   own shell — this group adds nothing to any URL. Analytics sits here for the
   same reason the header does: it belongs to the public site, not to /admin. */

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <GoogleAnalytics />
    </>
  );
}
