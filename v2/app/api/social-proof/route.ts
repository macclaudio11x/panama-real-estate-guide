/* =============================================================================
   GET /api/social-proof?path=/areas/boquete
   =============================================================================
   The line the mobile sticky bar shows above its button.

   Why an endpoint rather than a prop: the bar lives in app/(site)/layout.tsx,
   which has no params and so cannot know which area or project is on screen.
   The numbers also come from `leads`, which is service-role only — RLS is on
   with no policy — so they cannot be read from the client at all. One small
   request, made once, after the bar first appears.

   ── The rule this file exists to enforce ──────────────────────────────────
   Every number returned here is counted from rows that exist. Nothing is
   generated, seeded, smoothed, or "warmed up" while traffic is low, and there
   is deliberately no code path that could do so.

   A claim like "4 people asked about Boquete today" is a statement of fact to
   someone deciding where to put several hundred thousand dollars. Invented, it
   is a false popularity claim — an enumerated banned practice under the UK's
   DMCC Act 2024 and Annex I of the EU's UCPD, and actionable under FTC Act §5
   in the US. Those are this site's three biggest markets. It would also be the
   easiest thing in the world for a competitor to screenshot next to the line
   on the About page about not accepting payment for coverage.

   So when the real count is too small to be worth showing, this returns the
   fallback instead: a promise the site already makes on /contact and in the
   confirmation email, made specific to the place being read about. True today,
   at any traffic level, and it upgrades itself the moment the count clears.
   ============================================================================= */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Counting window. Long enough to accumulate something at low traffic, short
 *  enough that "recently" is not a stretch. */
const WINDOW_DAYS = 30;

/** At or above this the count is printed as a number. Below it there is still
 *  something true to say — see `line()` — it just isn't a figure, because
 *  "2 people" printed in a proof slot reads as an admission rather than a
 *  recommendation. Raise this once there is real volume. */
const COUNT_FROM = 5;

type Target =
  | { kind: "area"; slug: string }
  | { kind: "project"; slug: string }
  | null;

function parse(path: string | null): Target {
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts[0] === "areas") return { kind: "area", slug: parts[1] };
  if (parts[0] === "projects") return { kind: "project", slug: parts[1] };
  return null;
}

export async function GET(req: Request) {
  const target = parse(new URL(req.url).searchParams.get("path"));
  if (!target) return NextResponse.json({});

  const sb = supabaseAdmin();
  const table = target.kind === "area" ? "areas" : "projects";

  const { data: row } = await sb
    .from(table)
    .select("id, name")
    .eq("slug", target.slug)
    .maybeSingle();
  if (!row) return NextResponse.json({});

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { count, error } = await sb
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq(target.kind === "area" ? "area_id" : "project_id", row.id)
    .gte("created_at", since)
    /* ── The filter that makes this claim true ────────────────────────────
       Counting every row in `leads` counted the bots. Within a day of this
       going in, eight of the twelve rows in the table were scripted: a burst
       of Coinbase phishing that posts a URL as the full name, and a slower
       run of random-string submissions that trips no spam heuristic at all
       because it fills the fields in plausibly.

       They post to the project forms, so they arrive carrying `project` and
       `area` — meaning they land squarely on the pages this line renders on.
       "5 people have asked us about Boquete" was true of the table and false
       about the world, which is the same lie as inventing the number, just
       laundered through a database.

       No heuristic fixes that; the second bot proves it. What does fix it is
       requiring a person to have looked. A lead only leaves `new` when a
       human moves it in the CRM, and `lost` is where the spam gets filed, so
       counting the statuses in between counts leads somebody has confirmed
       are real. It undercounts, which is the right direction to be wrong in:
       the worst case is that a true number is too small to print and the
       fallback shows instead. */
    .in("status", ["contacted", "qualified", "viewing", "negotiating", "won"]);

  /* A failed count falls through to the fallback line. The bar is decoration
     on a page that already works; it must never be the thing that breaks. */
  const enquiries = error ? 0 : (count ?? 0);

  return NextResponse.json({ line: line(enquiries, row.name) });
}

/* =============================================================================
   Saying something true at every volume
   =============================================================================
   The honest problem with a real counter is that it starts small, and a real
   small number in a proof slot is worse than no number. The tiers below are the
   answer to that, and every one of them describes rows that exist:

     5+    the figure, because at that point it is worth quoting
     2–4   that other people asked, without a number attached
     1     that someone did, singular, because "others" would not be true
     0     no claim about demand at all, just what we will do if they write

   Note what the middle tiers are not. "Others have asked about Boquete this
   month" with two rows behind it is vague, and vague is fine. It would only
   become a lie if there were nothing behind it, which is the whole reason the
   zero case says something else entirely rather than rounding up to "others".
   ============================================================================= */
function line(enquiries: number, name: string): string {
  if (enquiries >= COUNT_FROM) {
    return `${enquiries} people have asked us about ${name} in the last 30 days.`;
  }
  if (enquiries > 1) {
    return `Other buyers have asked us for help with ${name} this month.`;
  }
  if (enquiries === 1) {
    return `Another buyer asked us for help with ${name} this month.`;
  }
  return `Asking about ${name}? A licensed broker usually replies within a business day.`;
}
