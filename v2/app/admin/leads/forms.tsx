"use client";

import { useActionState, useEffect, useRef } from "react";
import { LEAD_STATUSES, STATUS_LABEL, type BrokerRow, type LeadRow } from "@/lib/crm";
import { IDLE, logActivity, reassign, updateStatus } from "./actions";

/* Client components so a save can report itself. With a plain server-action
   form the page silently re-renders and the only proof anything happened is
   that the timeline grew — which is exactly the ambiguity that gets a note
   typed twice. */

const field =
  "w-full rounded-sm border border-line bg-paper px-3 py-2 text-[14.5px] text-body outline-none focus:border-brand transition-colors";

const label = "font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted";

function Feedback({ state }: { state: { ok: boolean; message: string | null } }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`text-[13px] ${state.ok ? "text-positive" : "text-negative"}`}
    >
      {state.message}
    </p>
  );
}

export function StatusForm({ lead }: { lead: LeadRow }) {
  const [state, action, pending] = useActionState(updateStatus, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5">
      <input type="hidden" name="lead_id" value={lead.id} />
      <h2 className="font-display text-[15.5px] font-bold text-ink">Status</h2>

      <select name="status" defaultValue={lead.status} className={field} aria-label="Status">
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <label className={label}>
        Follow up on
        <input
          type="date"
          name="next_action_at"
          defaultValue={lead.next_action_at?.slice(0, 10) ?? ""}
          className={`${field} mt-1.5`}
        />
      </label>

      <label className={label}>
        If lost, why
        <input
          name="lost_reason"
          defaultValue={lead.lost_reason ?? ""}
          placeholder="Bought elsewhere, budget, no reply…"
          className={`${field} mt-1.5`}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 cursor-pointer rounded-sm bg-accent px-5 py-2.5 font-display text-[14.5px] font-bold text-brand-900 transition-colors hover:bg-accent-600 hover:text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      <Feedback state={state} />
    </form>
  );
}

export function AssignForm({ lead, brokers }: { lead: LeadRow; brokers: BrokerRow[] }) {
  const [state, action, pending] = useActionState(reassign, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5">
      <input type="hidden" name="lead_id" value={lead.id} />
      <h2 className="font-display text-[15.5px] font-bold text-ink">Assigned to</h2>

      <select
        name="broker_id"
        defaultValue={lead.assigned_broker_id ?? ""}
        className={field}
        aria-label="Assigned broker"
      >
        <option value="">Nobody — back to the pool</option>
        {brokers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.firm ? ` · ${b.firm}` : ""} ({b.open_leads} open)
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-sm border-[1.5px] border-line px-5 py-2.5 font-display text-[14.5px] font-bold text-brand transition-colors hover:border-brand hover:bg-brand-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Hand over"}
      </button>

      <Feedback state={state} />
    </form>
  );
}

export function LogForm({ lead }: { lead: LeadRow }) {
  const [state, action, pending] = useActionState(logActivity, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box only once the note is actually recorded — on a failure the
  // text stays put so it can be retried rather than retyped.
  useEffect(() => {
    if (state.ok && state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5"
    >
      <input type="hidden" name="lead_id" value={lead.id} />
      <h2 className="font-display text-[15.5px] font-bold text-ink">Log something</h2>

      <select name="kind" defaultValue="call" className={field} aria-label="Activity type">
        <option value="call">Call</option>
        <option value="email">Email</option>
        <option value="note">Note</option>
      </select>

      <textarea
        name="body"
        rows={4}
        required
        placeholder="What happened?"
        className={field}
        aria-label="What happened"
      />

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-sm border-[1.5px] border-line px-5 py-2.5 font-display text-[14.5px] font-bold text-brand transition-colors hover:border-brand hover:bg-brand-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add to timeline"}
      </button>

      <Feedback state={state} />
    </form>
  );
}
