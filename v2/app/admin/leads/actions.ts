"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { LEAD_STATUSES, addNote, assignLead, setStatus, type LeadStatus } from "@/lib/crm";

/* Shared by the full lead page and the drawer, so both routes get the same
   authorisation and the same validation. Neither returns a redirect: the
   drawer has to stay open after a save, and Next re-renders the current route
   in the same response as the action anyway. */

export type FormState = { ok: boolean; message: string | null };

export const IDLE: FormState = { ok: true, message: null };

/** Both routes render a lead, and a save from either can change what the other
 *  shows. Cheap enough to refresh all of it. */
function revalidateLead(id: string) {
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/follow-ups");
  revalidatePath("/admin");
}

export async function logActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const id = String(formData.get("lead_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "note");
  const kind = (["note", "call", "email"] as const).find((k) => k === kindRaw);

  if (!id) return { ok: false, message: "Unknown lead." };
  if (!kind) return { ok: false, message: "Unknown activity type." };
  if (!body) return { ok: false, message: "Write something first." };

  try {
    await addNote(user, id, kind, body);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "That didn't save." };
  }

  revalidateLead(id);
  return { ok: true, message: "Added to the timeline." };
}

export async function updateStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const id = String(formData.get("lead_id") ?? "");
  const to = String(formData.get("status") ?? "") as LeadStatus;
  if (!id) return { ok: false, message: "Unknown lead." };
  if (!(LEAD_STATUSES as readonly string[]).includes(to)) {
    return { ok: false, message: "Unknown status." };
  }

  const lostReason = String(formData.get("lost_reason") ?? "").trim() || null;
  const nextAction = String(formData.get("next_action_at") ?? "").trim();

  // An empty date field means "no follow-up scheduled", which is a real
  // instruction and has to be able to unset the column.
  let nextActionAt: string | null = null;
  if (nextAction) {
    const parsed = new Date(nextAction);
    if (Number.isNaN(parsed.getTime())) return { ok: false, message: "That date didn't parse." };
    nextActionAt = parsed.toISOString();
  }

  try {
    await setStatus(user, id, to, { lostReason, nextActionAt });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "That didn't save." };
  }

  revalidateLead(id);
  return { ok: true, message: "Saved." };
}

/** Admin only — enforced in `assignLead`, not just by hiding the form. */
export async function reassign(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const id = String(formData.get("lead_id") ?? "");
  const brokerId = String(formData.get("broker_id") ?? "").trim() || null;
  if (!id) return { ok: false, message: "Unknown lead." };

  try {
    await assignLead(user, id, brokerId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "That didn't save." };
  }

  revalidateLead(id);
  return { ok: true, message: brokerId ? "Handed over." : "Returned to the pool." };
}
