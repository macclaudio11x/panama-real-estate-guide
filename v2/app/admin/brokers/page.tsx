import { requireRole } from "@/lib/admin-auth";
import { listBrokers } from "@/lib/crm";
import { EmptyState } from "../ui";
import { ActiveToggle, NewBrokerForm } from "./forms";

/* Admin only, enforced by requireRole here and again inside every action on
   this page — hiding a form is not access control. */

export default async function BrokersPage() {
  const admin = await requireRole("admin");
  const brokers = await listBrokers();

  return (
    <>
      <h1 className="font-display text-[24px] font-bold text-ink">Brokers</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        Who can sign in, and who leads can be handed to.
      </p>

      <div className="mt-7 grid items-start gap-6 min-[1000px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {brokers.length === 0 ? (
            <EmptyState>
              No brokers yet. The first admin is created by the SQL block at the bottom of
              0009_crm_access.sql; everyone after that is added here.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line bg-paper">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {["Name", "Contact", "Role", "Open leads", "Access", ""].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 font-mono text-[10.5px] font-normal uppercase tracking-[0.077em] text-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brokers.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-b border-line-soft align-top last:border-b-0 ${
                        b.is_active ? "" : "opacity-55"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-display font-bold text-ink">{b.name}</span>
                        {b.id === admin.brokerId && (
                          <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.077em] text-faint">
                            you
                          </span>
                        )}
                        {b.firm && <span className="block text-[13px] text-muted">{b.firm}</span>}
                      </td>

                      <td className="px-4 py-3 text-muted">
                        {b.email && <span className="block break-all">{b.email}</span>}
                        {b.phone && <span className="block">{b.phone}</span>}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted">
                          {b.role}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-display text-[15px] font-bold text-ink">
                        {b.open_leads}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-[13px]">
                        {!b.auth_user_id ? (
                          <span className="text-faint">no login</span>
                        ) : b.is_active ? (
                          <span className="text-positive">can sign in</span>
                        ) : (
                          <span className="text-negative">revoked</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <ActiveToggle broker={b} isSelf={b.id === admin.brokerId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <NewBrokerForm />
      </div>
    </>
  );
}
