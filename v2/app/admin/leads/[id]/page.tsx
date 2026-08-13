import Link from "next/link";
import { LeadDetail } from "../detail";

/* The full page. Reached by a hard load, a refresh or a shared link — a soft
   navigation from anywhere inside /admin is intercepted into the drawer
   instead (app/admin/@drawer). */

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <Link
        href="/admin/leads"
        className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted no-underline hover:text-brand"
      >
        ← All leads
      </Link>
      <div className="mt-4">
        <LeadDetail id={id} />
      </div>
    </>
  );
}
