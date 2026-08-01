/* =============================================================================
   What happens after a lead is saved
   =============================================================================
   Three side effects, none of which may block the response or fail the
   submission: the broker's email, the Meta conversion, the GA4 conversion. The
   row is already committed by the time any of this runs — a lead that saved but
   whose notification bounced is a nuisance; a lead rejected because Meta was
   slow is lost revenue.

   Everything here therefore returns rather than throws, and the caller fires
   them together and ignores the outcome beyond logging it.

   The Meta CAPI hashing and payload shape are carried over from
   netlify/functions/lead-submit.mjs, which is being retired. That part of it
   was correct and is independent of where leads are stored.
   ============================================================================= */

import { createHash, randomUUID } from "node:crypto";
import type { LeadInput, SavedLead } from "./leads";

const SITE = "https://panamarealestateguide.com";

/** Meta requires PII hashed: trimmed, lowercased, then sha256. */
function sha256(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex");
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

/* ── Meta Conversions API ───────────────────────────────────────────────────
   `event_id` is shared with the browser pixel when one fires, so Meta
   deduplicates the two into a single conversion instead of counting it twice.
   ------------------------------------------------------------------------- */

async function sendMetaCapi(
  input: LeadInput,
  ip: string | null,
  userAgent: string | null,
  eventId: string,
): Promise<void> {
  const pixel = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return;

  const [firstName, ...rest] = (input.full_name ?? "").split(" ");
  const userData = stripUndefined({
    em: input.email ? [sha256(input.email)] : undefined,
    ph: input.phone ? [sha256(input.phone.replace(/\D/g, ""))] : undefined,
    fn: firstName ? [sha256(firstName)] : undefined,
    ln: rest.length ? [sha256(rest.join(" "))] : undefined,
    fbc: input.fbclid ? `fb.1.${Date.now()}.${input.fbclid}` : undefined,
    fbp: input.fbp ?? undefined,
    client_ip_address: ip ?? undefined,
    client_user_agent: userAgent ?? undefined,
  });

  await fetch(`https://graph.facebook.com/v18.0/${pixel}/events?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: input.page_path ? `${SITE}${input.page_path}` : SITE,
          user_data: userData,
          custom_data: {
            currency: "USD",
            value: 50,
            content_category: "real_estate",
            content_name: input.project_slug ?? input.area_name ?? "website_lead",
          },
        },
      ],
    }),
  });
}

/* ── GA4 Measurement Protocol ───────────────────────────────────────────────
   Server-side so the conversion survives ad blockers and Safari's ITP, which
   between them eat a meaningful share of browser-side lead events.

   client_id: GA4 wants the browser's own _ga client id to stitch this event to
   the session that produced it. We don't have it on a native form post, so a
   random one is sent — the conversion counts, but it opens a new session rather
   than attaching to the existing one. Reading `_ga` in the attribution
   component would fix that; it is not worth a cookie parser today.
   ------------------------------------------------------------------------- */

async function sendGa4(input: LeadInput, eventId: string): Promise<void> {
  const id = process.env.GA4_MEASUREMENT_ID;
  const secret = process.env.GA4_API_SECRET;
  if (!id || !secret) return;

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${id}&api_secret=${secret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: eventId,
        events: [
          {
            name: "generate_lead",
            params: {
              currency: "USD",
              value: 50,
              page_path: input.page_path ?? undefined,
              campaign: input.utm_campaign ?? undefined,
              source: input.utm_source ?? undefined,
              medium: input.utm_medium ?? undefined,
            },
          },
        ],
      }),
    },
  );
}

/* ── Broker notification ────────────────────────────────────────────────────
   Plain text on purpose. This gets read on a phone, usually within the hour,
   and the qualifiers are the only reason to open it.
   ------------------------------------------------------------------------- */

async function sendBrokerEmail(lead: SavedLead, input: LeadInput): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_EMAIL;
  if (!key || !to) return;

  const line = (label: string, value: string | null) => (value ? `${label}: ${value}\n` : "");
  const body =
    `${input.full_name} — ${input.budget_band ?? "budget not given"}, ` +
    `${input.timeline ?? "timeline not given"}\n\n` +
    line("Email", input.email) +
    line("Phone", input.phone) +
    line("Lives in", input.country) +
    "\n" +
    line("Budget", input.budget_band) +
    line("Timeline", input.timeline) +
    line("Financing", input.financing) +
    line("Residency", input.residency_interest) +
    line("Area", input.area_name) +
    line("Project", input.project_slug) +
    (input.notes ? `\nNotes:\n${input.notes}\n` : "") +
    "\n" +
    line("Came from", input.page_path) +
    line("Campaign", input.utm_campaign) +
    line("Source", input.utm_source) +
    `\nReference ${lead.reference}\n${SITE}/admin/leads/${lead.id}\n`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Panama Real Estate Guide <leads@panamarealestateguide.com>",
      to: [to],
      reply_to: input.email ?? undefined,
      subject: `New lead — ${input.full_name}${input.project_slug ? ` · ${input.project_slug}` : ""}`,
      text: body,
    }),
  });
}

/* ── Caller-facing ──────────────────────────────────────────────────────────
   One await, three independent effects, no failure path back to the visitor.
   Each rejection is logged and dropped: a broken Meta token should be visible
   in the function log, not in someone's browser.
   ------------------------------------------------------------------------- */

export async function notifyLead(
  lead: SavedLead,
  input: LeadInput,
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  const eventId = randomUUID();
  const results = await Promise.allSettled([
    sendBrokerEmail(lead, input),
    sendMetaCapi(input, ip, userAgent, eventId),
    sendGa4(input, eventId),
  ]);
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      console.error(`lead ${lead.reference}: ${["email", "meta", "ga4"][i]} failed —`, r.reason);
    }
  }
}
