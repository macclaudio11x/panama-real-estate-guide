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
  spamSignals,
  validateLead,
} from "@/lib/leads";
import { notifyLead } from "@/lib/lead-notify";
import { TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";

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

/** True when the POST did not come from a page this site served.
 *
 *  Compared against the Host header rather than a hardcoded domain or
 *  `new URL(req.url)`, so it stays correct on deploy previews, on the
 *  netlify.app hostname, and on localhost without a list to maintain.
 *
 *  Absent headers pass. Browsers send Origin on cross-origin form posts, which
 *  is the case this exists to stop; some privacy tooling strips it on
 *  same-origin ones, and rejecting those would turn a header quirk into a lost
 *  buyer. */
function isCrossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const wantsJson = contentType.includes("application/json");

  if (isCrossOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin submissions are not accepted." }, { status: 403 });
  }

  let input;
  let token: string | null = null;
  try {
    // The getter is kept rather than the container, so the Turnstile token can
    // be read out of whichever body shape arrived without either dialect being
    // converted into the other.
    let read: (name: string) => unknown;
    if (wantsJson) {
      const body = (await req.json()) as Record<string, unknown>;
      read = (name) => body?.[name];
    } else {
      const form = await req.formData();
      read = (name) => form.get(name);
    }
    input = readLeadInput(read);
    const raw = read(TURNSTILE_FIELD);
    token = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
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

  /* ── Turnstile ───────────────────────────────────────────────────────────
     Checked after validation so a half-filled form does not burn a token, and
     before anything touches the database.

     A token that is present and does not verify is rejected outright: that is
     either a replay, a forgery, or our own secret being wrong, and none of the
     three should reach the leads table. A token that is absent is a different
     thing — see TurnstileVerdict — and falls through to the checks below,
     because these forms are built to submit with JavaScript off and the widget
     is the one part of them that cannot. */
  const verdict = await verifyTurnstile(token, ip);
  if (verdict === "failed") {
    return fail(
      "We couldn't verify that submission. Please reload the page and try again.",
      403,
    );
  }

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

  /* Saved either way. A lead that looks like spam is still shown to the broker,
     because a false positive that vanishes silently is worse than a junk row he
     can delete in one click. What it does not get is the confirmation email —
     that is the one side effect an abuser can point at a third party, and the
     one that costs us the sending domain rather than five seconds. */
  const suspicious = spamSignals(input);

  // Committed. Everything past here is best-effort.
  await Promise.allSettled([
    logIntake(lead, input, suspicious),
    notifyLead(lead, input, ip, req.headers.get("user-agent"), suspicious),
  ]);

  if (wantsJson) {
    return NextResponse.json({ ok: true, reference: lead.reference });
  }
  return NextResponse.redirect(
    new URL(`/contact/thanks?ref=${encodeURIComponent(lead.reference)}`, req.url),
    303,
  );
}
