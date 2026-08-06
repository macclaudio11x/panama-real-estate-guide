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

/** Below this the count is not shown at all. Two enquiries is not evidence
 *  that anyone else is interested, and printing it reads as an admission. Raise
 *  it once there is real volume; never lower it to make something appear. */
const MIN_TO_SHOW = 5;

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
    .gte("created_at", since);

  /* A failed count falls through to the fallback line. The bar is decoration
     on a page that already works; it must never be the thing that breaks. */
  const enquiries = error ? 0 : (count ?? 0);

  if (enquiries >= MIN_TO_SHOW) {
    return NextResponse.json({
      line: `${enquiries} people have asked us about ${row.name} in the last 30 days.`,
    });
  }

  return NextResponse.json({
    line: `Asking about ${row.name}? A licensed broker usually replies within a business day.`,
  });
}
