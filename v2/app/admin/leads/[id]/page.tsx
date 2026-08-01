import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import {
  LEAD_STATUSES,
  STATUS_LABEL,
  type LeadStatus,
  addNote,
  getLead,
  getLeadEvents,
  setStatus,
} from "@/lib/crm";

/* One lead: who they are, what they want, where they came from, and everything
   anyone has done about it. The timeline is the point — a status alone tells
   you where a lead is but not whether it is being worked. */

/* ── Server actions ─────────────────────────────────────────────────────── */

async function noteAction(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const id = String(formData.get("lead_id"));
  const body = String(formData.get("body") ?? "").trim();
  const kind = String(formData.get("kind") ?? "note") as "note" | "call" | "email";
  if (!body) redirect(`/admin/leads/${id}`);

  await addNote(id, user.email, kind, body);
  revalidatePath(`/admin/leads/${id}`);
  redirect(`/admin/leads/${id}`);
}

async function statusAction(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const id = String(formData.get("lead_id"));
  const to = String(formData.get("status")) as LeadStatus;
  if (!(LEAD_STATUSES as readonly string[]).includes(to)) redirect(`/admin/leads/${id}`);

  const lostReason = String(formData.get("lost_reason") ?? "").trim() || null;
  const nextAction = String(formData.get("next_action_at") ?? "").trim();

  await setStatus(id, user.email, to, {
    lostReason,
    // A cleared date field means "no follow-up scheduled", which is a real
    // instruction and has to be able to unset the column.
    nextActionAt: nextAction ? new Date(nextAction).toISOString() : null,
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  redirect(`/admin/leads/${id}`);
}

/* ── View ───────────────────────────────────────────────────────────────── */

const dt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px] text-body break-words">{value}</dd>
    </div>
  );
}

const field =
  "w-full rounded-sm border border-line bg-white px-3 py-2 text-[15px] text-body focus:border-brand outline-none";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const lead = await getLead(id);
  if (!lead) notFound();
  const events = await getLeadEvents(id);

  const campaign = [lead.utm_source, lead.utm_medium, lead.utm_campaign]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Link
        href="/admin/leads"
        className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted no-underline hover:text-brand"
      >
        ← All leads
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-[26px] font-bold text-ink">{lead.full_name}</h1>
        <span className="font-mono text-[12px] text-faint">{lead.reference}</span>
      </div>
      <p className="mt-1.5 text-[14.5px] text-muted">
        Submitted {dt(lead.created_at)}
        {lead.broker ? ` · assigned to ${lead.broker.name}` : " · no broker assigned"}
      </p>

      <div className="mt-8 grid gap-8 min-[980px]:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="min-w-0">
          {/* ── Facts ─────────────────────────────────────────────────── */}
          <section className="rounded-md border border-line bg-white p-6">
            <h2 className="font-display text-[17px] font-bold text-ink">Enquiry</h2>
            <dl className="mt-4 grid gap-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Lives in" value={lead.country} />
              <Field label="Budget" value={lead.budget_band} />
              <Field label="Timeline" value={lead.timeline} />
              <Field label="Financing" value={lead.financing} />
              <Field label="Residency" value={lead.residency_interest} />
              <Field label="Project" value={lead.project?.name ?? null} />
              <Field label="Area" value={lead.area?.name ?? null} />
            </dl>
            {lead.notes && (
              <div className="mt-6 pt-5 border-t border-line">
                <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
                  What they wrote
                </p>
                <p className="mt-2 text-[15.5px] leading-relaxed text-body whitespace-pre-line">
                  {lead.notes}
                </p>
              </div>
            )}
          </section>

          {/* ── Attribution ───────────────────────────────────────────── */}
          <section className="mt-6 rounded-md border border-line bg-white p-6">
            <h2 className="font-display text-[17px] font-bold text-ink">Where it came from</h2>
            <dl className="mt-4 grid gap-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              <Field label="Page" value={lead.page_path} />
              <Field label="Campaign" value={campaign || null} />
              <Field label="Referrer" value={lead.referrer} />
              <Field label="Google click" value={lead.gclid} />
              <Field label="Meta click" value={lead.fbclid} />
              <Field label="Consented" value={dt(lead.consented_at)} />
            </dl>
            {!campaign && !lead.referrer && !lead.page_path && (
              <p className="mt-3 text-[14.5px] text-muted">
                No attribution captured — the submission carried no campaign or referrer.
              </p>
            )}
          </section>

          {/* ── Timeline ──────────────────────────────────────────────── */}
          <section className="mt-6">
            <h2 className="font-display text-[17px] font-bold text-ink">Activity</h2>
            <ol className="mt-4 flex flex-col gap-3">
              {events.map((e) => (
                <li key={e.id} className="rounded-md border border-line bg-white px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
                    {e.kind === "status_change"
                      ? `${e.from_status ? STATUS_LABEL[e.from_status] : "—"} → ${
                          e.to_status ? STATUS_LABEL[e.to_status] : "—"
                        }`
                      : e.kind}
                    <span className="text-faint"> · {dt(e.created_at)}</span>
                    {e.actor_email && <span className="text-faint"> · {e.actor_email}</span>}
                  </p>
                  {e.body && (
                    <p className="mt-1.5 text-[15px] leading-relaxed text-body whitespace-pre-line">
                      {e.body}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-6 min-[980px]:sticky min-[980px]:top-6">
          <form
            action={statusAction}
            className="rounded-md border border-line bg-white p-5 flex flex-col gap-3"
          >
            <input type="hidden" name="lead_id" value={lead.id} />
            <h2 className="font-display text-[16px] font-bold text-ink">Status</h2>

            <select name="status" defaultValue={lead.status} className={field}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>

            <label className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
              Follow up on
              <input
                type="date"
                name="next_action_at"
                defaultValue={lead.next_action_at?.slice(0, 10) ?? ""}
                className={`${field} mt-1.5`}
              />
            </label>

            <label className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
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
              className="mt-1 font-display text-[15px] font-bold px-5 py-2.5 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer"
            >
              Save
            </button>
          </form>

          <form
            action={noteAction}
            className="rounded-md border border-line bg-white p-5 flex flex-col gap-3"
          >
            <input type="hidden" name="lead_id" value={lead.id} />
            <h2 className="font-display text-[16px] font-bold text-ink">Log something</h2>

            <select name="kind" defaultValue="note" className={field}>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
            </select>

            <textarea
              name="body"
              rows={4}
              required
              placeholder="What happened?"
              className={field}
            />

            <button
              type="submit"
              className="font-display text-[15px] font-bold px-5 py-2.5 rounded-sm border-[1.5px] border-line text-brand hover:border-brand hover:bg-brand-50 transition-colors cursor-pointer"
            >
              Add to timeline
            </button>
          </form>

          {lead.email && (
            <a
              href={`mailto:${lead.email}?subject=${encodeURIComponent(
                `Your Panama property enquiry (${lead.reference})`,
              )}`}
              className="rounded-md border border-line bg-white px-5 py-3 text-center font-display text-[15px] font-bold text-brand no-underline hover:border-brand transition-colors"
            >
              Email {lead.full_name.split(" ")[0]}
            </a>
          )}
        </aside>
      </div>
    </>
  );
}
