"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { LEAD_STATUSES, setStatus, type LeadStatus } from "@/lib/crm";

/* The board's one mutation. Reached by POST like any Server Action, so it
   re-authenticates and re-authorises rather than trusting that the card was
   rendered on a screen the caller was allowed to see — `setStatus` re-reads
   ownership from the row itself. */

export type MoveResult = { ok: true } | { ok: false; error: string };

export async function moveLead(leadId: string, to: LeadStatus): Promise<MoveResult> {
  const user = await requireAdmin();

  // The client says which lead and which column. Both are validated: the
  // status against the enum, the lead against who owns it.
  if (!(LEAD_STATUSES as readonly string[]).includes(to)) {
    return { ok: false, error: "Unknown status." };
  }
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { ok: false, error: "Unknown lead." };
  }

  try {
    await setStatus(user, leadId, to);
  } catch (e) {
    // Returned rather than thrown so the board can roll the card back and say
    // why, instead of the optimistic state silently sticking.
    return { ok: false, error: e instanceof Error ? e.message : "That didn't save." };
  }

  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
  return { ok: true };
}
