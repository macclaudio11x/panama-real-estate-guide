import { after } from "next/server";
import { mailConfigured, syncInbox } from "@/lib/mail";

/* The IMAP poll, as an endpoint so the scheduler is replaceable. Netlify calls
   it on a cron today; anything that can send an authenticated GET works.

   IMAP is a socket protocol with real latency — this cannot run on the edge,
   and must not be cached under any circumstances. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Shared secret, compared in constant time. A timing-safe compare is cheap
 *  insurance on an endpoint whose URL is guessable and which reads a mailbox. */
function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }
  if (!mailConfigured()) {
    return Response.json({ error: "Mail is not configured." }, { status: 503 });
  }

  const result = await syncInbox();

  // A sync that failed must not answer 200 — the scheduler's log is the only
  // place anyone would notice a mailbox quietly falling behind.
  return Response.json(result, { status: result.error ? 502 : 200 });
}

/** Same work, for a scheduler that would rather POST. */
export async function POST(request: Request) {
  return GET(request);
}
