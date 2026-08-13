import Link from "next/link";
import { STATUS_LABEL, type LeadRow, type LeadStatus } from "@/lib/crm";

/* The handful of pieces every admin screen repeats. Kept together so a status
   never renders in one colour on the board and another in the inbox. */

/** Colour carries meaning in exactly two places: something needs picking up
   (accent), and something ended (positive/negative). The five working statuses
   in between are deliberately neutral — if everything is highlighted, the two
   that matter stop being visible. */
export const STATUS_TONE: Record<LeadStatus, string> = {
  new: "border-accent-600/35 bg-accent-50 text-accent-700",
  contacted: "border-line bg-paper-warm text-muted",
  qualified: "border-line bg-paper-warm text-muted",
  viewing: "border-line bg-paper-warm text-muted",
  negotiating: "border-line bg-paper-warm text-muted",
  won: "border-positive/30 bg-positive-50 text-positive",
  lost: "border-line bg-paper-warm text-faint",
};

export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.077em] whitespace-nowrap ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function when(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / (60 * 24));
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Days until (positive) or since (negative) a date, counted in whole calendar
 *  days so "due today" means today rather than within 24 hours. */
export function daysUntil(iso: string): number {
  const then = new Date(iso);
  then.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - now.getTime()) / 86_400_000);
}

export function dueLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  if (d > 0) return `in ${d}d`;
  if (d === -1) return "1d overdue";
  return `${-d}d overdue`;
}

export const dt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** The badge that stops an in-guide lead reading as someone who could not be
 *  bothered to finish the form. They were never asked for a budget, and the
 *  difference decides how the call opens — see 0006_lead_intent.sql. */
export function IntentBadge({ intent }: { intent: LeadRow["intent"] }) {
  if (intent !== "article") return null;
  return (
    <span className="inline-flex w-fit items-center rounded-sm border border-line bg-paper-warm px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.077em] text-muted">
      From a guide · not qualified
    </span>
  );
}

/** Where a lead came from, in one line: the development or area it was about,
 *  falling back to the page and then the campaign. */
export function source(lead: LeadRow): string {
  return lead.project?.name ?? lead.area?.name ?? lead.page_path ?? "—";
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-paper-warm px-5 py-8 text-center text-[14.5px] text-muted">
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  count,
  tone = "neutral",
  hint,
}: {
  title: string;
  count: number;
  tone?: "neutral" | "urgent";
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h2 className="font-display text-[17px] font-bold text-ink">{title}</h2>
      <span
        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
          tone === "urgent" && count > 0
            ? "bg-negative-50 text-negative"
            : "bg-paper-warm text-muted"
        }`}
      >
        {count}
      </span>
      {hint && <p className="text-[13.5px] text-muted">{hint}</p>}
    </div>
  );
}

/** The row used by every list that is not the board. One component so the
 *  inbox, the queue and the search results cannot drift apart. */
export function LeadListRow({ lead, note }: { lead: LeadRow; note?: string }) {
  return (
    <Link
      href={`/admin/leads/${lead.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-brand"
    >
      <div className="min-w-[150px] flex-1">
        <span className="font-display text-[15px] font-bold text-ink">{lead.full_name}</span>
        <span className="ml-2 font-mono text-[10.5px] text-faint">{lead.reference}</span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <IntentBadge intent={lead.intent} />
        </div>
      </div>

      <span className="text-[13.5px] text-muted">{source(lead)}</span>

      {note && (
        <span className="font-mono text-[11px] uppercase tracking-[0.077em] text-negative">
          {note}
        </span>
      )}

      <span className="text-[13px] text-faint">
        {lead.broker?.name ?? <em className="not-italic text-accent-700">unassigned</em>}
      </span>

      <StatusPill status={lead.status} />
    </Link>
  );
}
