import { requireAdmin } from "@/lib/admin-auth";
import { listLeads } from "@/lib/crm";
import { Board } from "./board";

/* The board shows the whole pipeline including won and lost, because the two
   terminal columns are where you look to see whether the middle is moving. */

export default async function Pipeline() {
  const user = await requireAdmin();
  const leads = await listLeads(user);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-5">
        <div>
          <h1 className="font-display text-[24px] font-bold text-ink">Pipeline</h1>
          <p className="mt-1 text-[14.5px] text-muted">
            {user.role === "admin"
              ? "Every lead, by stage. Drag a card, or use the menu on it."
              : "Your leads, by stage. Drag a card, or use the menu on it."}
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-faint">
          {leads.length} {leads.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      {leads.length === 0 ? (
        <p className="text-[15px] text-muted">
          {user.role === "admin"
            ? "No leads yet. Submissions from the contact form and the project pages land here."
            : "Nothing assigned to you yet."}
        </p>
      ) : (
        <Board leads={leads} canReassign={user.role === "admin"} />
      )}
    </>
  );
}
