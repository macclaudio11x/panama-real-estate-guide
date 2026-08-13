import { Drawer } from "../../../drawer";
import { LeadDetail } from "../../../leads/detail";

/* Intercepts a soft navigation to /admin/leads/[id] from anywhere under
   /admin — the inbox, the board, the queue, the search results — and renders
   the lead over the top of whatever you were looking at.

   `(.)leads` matches on segments, not folders: the @drawer slot is not a
   segment, so this sits at the same level as /admin/leads. A hard load or a
   refresh of the same URL skips interception entirely and renders the full
   page, which is why the URL is worth sharing. */

export default async function LeadDrawer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Drawer>
      <LeadDetail id={id} compact />
    </Drawer>
  );
}
