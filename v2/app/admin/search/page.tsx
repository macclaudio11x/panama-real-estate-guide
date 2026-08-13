import { requireAdmin } from "@/lib/admin-auth";
import { searchLeads } from "@/lib/crm";
import { EmptyState, LeadListRow } from "../ui";

export default async function SearchResults({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdmin();
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const leads = term.length >= 2 ? await searchLeads(user, term) : [];

  return (
    <>
      <h1 className="font-display text-[24px] font-bold text-ink">
        {term ? `“${term}”` : "Search"}
      </h1>
      <p className="mt-1 text-[14.5px] text-muted">
        {term.length < 2
          ? "Type at least two characters into the box above."
          : `${leads.length} ${leads.length === 1 ? "match" : "matches"} across name, email, phone, reference and country.`}
      </p>

      <div className="mt-6">
        {term.length >= 2 && leads.length === 0 ? (
          <EmptyState>
            Nothing matched “{term}”.
            {user.role === "broker" && " You only see leads assigned to you."}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {leads.map((lead) => (
              <LeadListRow key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
