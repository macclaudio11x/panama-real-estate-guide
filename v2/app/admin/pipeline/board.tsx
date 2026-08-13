"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { LEAD_STATUSES, STATUS_LABEL, type LeadRow, type LeadStatus } from "@/lib/crm";
import { moveLead } from "./actions";

/* Drag-and-drop is the fast path, not the only path. HTML5 drag events do not
   fire on touch at all, so every card also carries a native <select> — which
   is the primary control on a phone and the keyboard route on a desktop. Both
   call the same action. */

type Props = { leads: LeadRow[]; canReassign: boolean };

const money = (l: LeadRow) => l.budget_band ?? (l.intent === "article" ? "not asked" : "no budget");

export function Board({ leads, canReassign }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);

  // The optimistic layer holds only the override, so a card that fails to save
  // reverts by itself when the transition ends and the server state wins.
  const [optimistic, applyOptimistic] = useOptimistic(
    leads,
    (state: LeadRow[], move: { id: string; to: LeadStatus }) =>
      state.map((l) => (l.id === move.id ? { ...l, status: move.to } : l)),
  );

  function move(id: string, to: LeadStatus) {
    const current = optimistic.find((l) => l.id === id);
    if (!current || current.status === to) return;

    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, to });
      const result = await moveLead(id, to);
      if (!result.ok) setError(result.error);
    });
  }

  const columns = LEAD_STATUSES.map((status) => ({
    status,
    leads: optimistic.filter((l) => l.status === status),
  }));

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-negative/30 bg-negative-50 px-3 py-2 text-[14px] text-negative"
        >
          {error}
        </p>
      )}

      <div
        className={`flex gap-3 overflow-x-auto pb-4 ${pending ? "opacity-95" : ""}`}
        aria-busy={pending}
      >
        {columns.map(({ status, leads: column }) => (
          <section
            key={status}
            onDragOver={(e) => {
              // Without preventDefault the drop never fires — the default
              // handling rejects it.
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              setOver(null);
              setDragging(null);
              if (id) move(id, status);
            }}
            className={`flex w-[236px] shrink-0 flex-col rounded-md border bg-paper-warm transition-colors ${
              over === status ? "border-brand bg-brand-50" : "border-line"
            }`}
          >
            <header className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2.5">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted">
                {STATUS_LABEL[status]}
              </h2>
              <span className="font-display text-[13px] font-bold text-ink">{column.length}</span>
            </header>

            <div className="flex flex-col gap-2 p-2 min-h-[80px]">
              {column.length === 0 && (
                <p className="px-1 py-3 text-center text-[12.5px] text-faint">—</p>
              )}

              {column.map((lead) => (
                <article
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", lead.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(lead.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={`rounded-sm border border-line bg-paper p-2.5 transition-shadow ${
                    dragging === lead.id ? "opacity-40" : "hover:shadow-sm"
                  } cursor-grab active:cursor-grabbing`}
                >
                  <Link
                    href={`/admin/leads/${lead.id}`}
                    className="font-display text-[14px] font-bold text-ink no-underline hover:text-brand"
                  >
                    {lead.full_name}
                  </Link>

                  <p className="mt-0.5 text-[12.5px] text-muted">{money(lead)}</p>

                  {(lead.project?.name || lead.area?.name) && (
                    <p className="mt-0.5 truncate text-[12px] text-faint">
                      {lead.project?.name ?? lead.area?.name}
                    </p>
                  )}

                  {lead.intent === "article" && (
                    <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.077em] text-accent-700">
                      Not qualified
                    </p>
                  )}

                  {canReassign && (
                    <p className="mt-1 truncate text-[11.5px] text-faint">
                      {lead.broker?.name ?? "unassigned"}
                    </p>
                  )}

                  <label className="mt-2 block">
                    <span className="sr-only">Move {lead.full_name} to another status</span>
                    <select
                      value={lead.status}
                      onChange={(e) => move(lead.id, e.target.value as LeadStatus)}
                      className="w-full rounded-sm border border-line bg-paper-warm px-1.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted outline-none focus:border-brand cursor-pointer"
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
