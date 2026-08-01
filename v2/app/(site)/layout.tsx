import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/* Public-site chrome. Lifted out of the root layout so /admin can render its
   own shell — this group adds nothing to any URL. */

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
