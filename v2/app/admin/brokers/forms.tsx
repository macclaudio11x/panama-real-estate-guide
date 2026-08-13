"use client";

import { useActionState } from "react";
import type { BrokerRow } from "@/lib/crm";
import { BROKER_IDLE, createBroker, setBrokerActive } from "./actions";

const field =
  "w-full rounded-sm border border-line bg-paper px-3 py-2 text-[14.5px] text-body outline-none focus:border-brand transition-colors";
const label = "font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted";

export function NewBrokerForm() {
  const [state, action, pending] = useActionState(createBroker, BROKER_IDLE);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5">
      <h2 className="font-display text-[15.5px] font-bold text-ink">Add a broker</h2>

      <label className={label}>
        Name
        <input name="name" required className={`${field} mt-1.5`} />
      </label>

      <label className={label}>
        Email
        <input name="email" type="email" className={`${field} mt-1.5`} />
      </label>

      <label className={label}>
        Firm
        <input name="firm" className={`${field} mt-1.5`} />
      </label>

      <label className={label}>
        Phone
        <input name="phone" className={`${field} mt-1.5`} />
      </label>

      <label className={label}>
        Role
        <select name="role" defaultValue="broker" className={`${field} mt-1.5`}>
          <option value="broker">Broker — only leads assigned to them</option>
          <option value="admin">Admin — every lead, and can reassign</option>
        </select>
      </label>

      <label className="flex items-start gap-2 text-[13.5px] text-body">
        <input type="checkbox" name="with_login" defaultChecked className="mt-1 cursor-pointer" />
        <span>
          Create a sign-in for them
          <span className="block text-[12.5px] text-muted">
            Leave this off for a broker who should receive leads but not have a login.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-sm bg-accent px-5 py-2.5 font-display text-[14.5px] font-bold text-brand-900 transition-colors hover:bg-accent-600 hover:text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Add broker"}
      </button>

      {state.message && (
        <p
          role="status"
          className={`text-[13px] ${state.ok ? "text-positive" : "text-negative"}`}
        >
          {state.message}
        </p>
      )}

      {state.tempPassword && (
        <div className="rounded-sm border border-accent-600/40 bg-accent-50 px-3 py-2.5">
          <p className={label}>Temporary password</p>
          <code className="mt-1 block font-mono text-[14px] break-all text-ink select-all">
            {state.tempPassword}
          </code>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Copy it now — it is not stored and cannot be shown again. Reset it from the Supabase
            dashboard if it is lost.
          </p>
        </div>
      )}
    </form>
  );
}

export function ActiveToggle({ broker, isSelf }: { broker: BrokerRow; isSelf: boolean }) {
  const [state, action, pending] = useActionState(setBrokerActive, BROKER_IDLE);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="broker_id" value={broker.id} />
      <input type="hidden" name="active" value={String(!broker.is_active)} />

      <button
        type="submit"
        disabled={pending || isSelf}
        title={isSelf ? "You cannot deactivate your own account." : undefined}
        className="cursor-pointer rounded-sm border border-line px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "…" : broker.is_active ? "Revoke" : "Restore"}
      </button>

      {state.message && (
        <p className={`max-w-[240px] text-right text-[12px] ${state.ok ? "text-positive" : "text-negative"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
