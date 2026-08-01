/* =============================================================================
   POST /api/lead
   =============================================================================
   The endpoint both lead forms have been posting to since the v2 cutover, and
   which until now did not exist — every submission 404'd.

   It answers in whichever dialect it was asked in. The forms in
   app/contact/page.tsx and app/projects/[slug]/page.tsx are plain HTML with no
   JavaScript behind them, so the default path is a form-encoded POST answered
   with a 303 redirect. A fetch() caller sending JSON gets JSON back. Keeping
   the no-JS path working is deliberate: it is the one that cannot break in a
   browser we did not test.

   Ordering matters here. The row is committed before any notification fires,
   so a Meta outage or a bounced broker email can never cost us the lead.
   ============================================================================= */

import { NextResponse } from "next/server";
import {
  clientIp,
  hashIp,
  isRateLimited,
  logIntake,
  readLeadInput,
  resolveContext,
  saveLead,
  validateLead,
} from "@/lib/leads";
import { notifyLead } from "@/lib/lead-notify";

// Leads are written per request and never cached or prerendered.
export const dynamic = "force-dynamic";

/** Where a failed form post sends the visitor: back to the form they were on,
 *  with a message, rather than to a dead-end error page.
 *
 *  page_path comes from the attribution component, so it is absent when
 *  JavaScript is off — exactly the case where a redirect is the only way to
 *  show an error at all. The Referer header covers it, and same-origin is
 *  enforced so the header cannot be used to bounce anyone off the site. */
function backToForm(req: Request, pagePath: string | null, message: string) {
  let path = pagePath && pagePath.startsWith("/") ? pagePath : null;
  if (!path) {
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const url = new URL(referer);
        if (url.origin === new URL(req.url).origin) path = url.pathname;
      } catch {
        // Unparseable Referer — fall through to /contact.
      }
    }
  }
  return `${path ?? "/contact"}?lead_error=${encodeURIComponent(message)}#lead-form`;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const wantsJson = contentType.includes("application/json");

  let input;
  try {
    if (wantsJson) {
      const body = (await req.json()) as Record<string, unknown>;
      input = readLeadInput((name) => body?.[name]);
    } else {
      const form = await req.formData();
      input = readLeadInput((name) => form.get(name));
    }
  } catch {
    return NextResponse.json({ error: "Could not read the submission." }, { status: 400 });
  }

  const fail = (message: string, status: number) =>
    wantsJson
      ? NextResponse.json({ error: message }, { status })
      : NextResponse.redirect(new URL(backToForm(req, input.page_path, message), req.url), 303);

  /* ── Bots ────────────────────────────────────────────────────────────────
     The honeypot field is already in the contact form markup. A filled one is
     answered with the same 303 a success would produce: a bot that can tell
     rejection from acceptance is a bot that can be tuned against us. */
  if (input.honeypot) {
    return wantsJson
      ? NextResponse.json({ ok: true })
      : NextResponse.redirect(new URL("/contact/thanks", req.url), 303);
  }

  const invalid = validateLead(input);
  if (invalid) return fail(invalid, 400);

  const ip = clientIp(req.headers);
  const ipHash = hashIp(ip);

  if (await isRateLimited(ipHash)) {
    return fail(
      "We already have a few enquiries from you in the last hour — a broker will be in touch.",
      429,
    );
  }

  /* ── The part that must not fail silently ────────────────────────────── */
  let lead;
  try {
    const context = await resolveContext(input);
    lead = await saveLead(input, context, ipHash);
  } catch (err) {
    // A visitor cannot act on a Postgres error, but we need it in the log —
    // this is the path where a real buyer disappears.
    console.error("lead insert failed —", err);
    return fail("Something went wrong saving your details. Please try again.", 500);
  }

  // Committed. Everything past here is best-effort.
  await Promise.allSettled([
    logIntake(lead, input),
    notifyLead(lead, input, ip, req.headers.get("user-agent")),
  ]);

  if (wantsJson) {
    return NextResponse.json({ ok: true, reference: lead.reference });
  }
  return NextResponse.redirect(
    new URL(`/contact/thanks?ref=${encodeURIComponent(lead.reference)}`, req.url),
    303,
  );
}
