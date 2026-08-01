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

/* ── Broker alert, over Telegram ────────────────────────────────────────────
   The broker's alert and the buyer's email are two different jobs, so they use
   two different channels. This one wants to be read within the hour on a
   phone, so it leads with the qualifiers that decide whether to call now or
   this afternoon, and ends with a link straight to the lead in the admin.

   Same bot pattern and the same two env vars as CasadeEmpleo's
   subscribers-daily function.
   ------------------------------------------------------------------------- */

async function sendTelegramAlert(lead: SavedLead, input: LeadInput): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;

  const line = (label: string, value: string | null) => (value ? `${label}: ${value}\n` : "");
  const text =
    `🏠 New lead: ${input.full_name}\n` +
    `${input.budget_band ?? "budget not given"} · ${input.timeline ?? "timeline not given"}\n\n` +
    line("Email", input.email) +
    line("Phone", input.phone) +
    line("Lives in", input.country) +
    line("Financing", input.financing) +
    line("Residency", input.residency_interest) +
    line("Project", input.project_slug) +
    line("Area", input.area_name) +
    (input.notes ? `\n"${input.notes}"\n` : "") +
    "\n" +
    line("Page", input.page_path) +
    line("Campaign", [input.utm_source, input.utm_campaign].filter(Boolean).join(" / ") || null) +
    `\n${lead.reference}\n${SITE}/admin/leads/${lead.id}`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

/* ── Buyer confirmation ─────────────────────────────────────────────────────
   Sent to the person who filled the form, and only when they gave an email.

   Deliberately NOT a "welcome to our community" email. Both forms promise in
   as many words that we don't add anyone to a mailing list they didn't ask
   for, and an email that reads like a list signup breaks that promise on the
   very first contact. So this confirms what they did, says what happens next,
   and gives them something worth reading in the meantime. It is transactional,
   which is also what keeps it out of the bulk-mail rules that would otherwise
   require an unsubscribe header.
   ------------------------------------------------------------------------- */

/* Process, title risk, residency — the three things every foreign buyer asks
   about in that order. Hardcoded rather than queried: a confirmation email
   should not depend on a database read, and these three are the site's most
   load-bearing guides.

   ⚠️ These paths are checked against lib/content.ts by hand. If a slug is ever
   renamed, this email starts linking to 404s at the exact moment a buyer's
   trust is newest. */
const GUIDES = [
  ["Buying property in Panama, step by step", "/buying/panama-property-buying-process-guide"],
  ["Titled land vs. Rights of Possession", "/buying/titled-vs-rights-of-possession"],
  ["The Friendly Nations Visa in 2026", "/residency/friendly-nations-2026"],
] as const;

/** Exported so the copy can be rendered and read without sending anything —
 *  see scripts/preview-welcome-email.mjs. */
export function renderClientWelcome(
  lead: SavedLead,
  input: Pick<LeadInput, "full_name">,
): { subject: string; text: string; html: string } {
  const firstName = input.full_name.split(" ")[0];

  const text =
    `Hi ${firstName},\n\n` +
    `Thanks for getting in touch. We have your details, and your reference is ${lead.reference}.\n\n` +
    `What happens next:\n\n` +
    `1. We read what you sent and rule out the areas that fit worst. A person does this, not an algorithm.\n` +
    `2. You get a shortlist with the title status and delivery date of everything on it.\n` +
    `3. A licensed broker calls to talk it through, usually within one business day.\n\n` +
    `While you wait, these are the guides most buyers read first:\n\n` +
    GUIDES.map(([title, path]) => `${title}\n${SITE}${path}\n`).join("\n") +
    `\nOne thing worth knowing before you speak to anyone: not all land in Panama is titled. ` +
    `Some is held under Rights of Possession, which is a weaker claim than ownership and is not ` +
    `always disclosed up front. We say which is which on every project we list.\n\n` +
    `We pass your details to one licensed broker and nobody else. Reply to this email if anything ` +
    `changes or you'd rather we didn't.\n\n` +
    `Panama Real Estate Guide\n${SITE}\n`;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f262b;max-width:560px">` +
    `<p>Hi ${esc(firstName)},</p>` +
    `<p>Thanks for getting in touch. We have your details, and your reference is ` +
    `<strong style="font-family:ui-monospace,monospace">${esc(lead.reference)}</strong>.</p>` +
    `<p><strong>What happens next</strong></p>` +
    `<ol><li>We read what you sent and rule out the areas that fit worst. A person does this, not an algorithm.</li>` +
    `<li>You get a shortlist with the title status and delivery date of everything on it.</li>` +
    `<li>A licensed broker calls to talk it through, usually within one business day.</li></ol>` +
    `<p><strong>While you wait</strong></p><ul>` +
    GUIDES.map(
      ([title, path]) =>
        `<li><a href="${SITE}${path}" style="color:#0b4f6c">${esc(title)}</a></li>`,
    ).join("") +
    `</ul>` +
    `<p style="border-left:3px solid #e8a33d;padding-left:14px;color:#1f262b">One thing worth knowing ` +
    `before you speak to anyone: not all land in Panama is titled. Some is held under Rights of ` +
    `Possession, which is a weaker claim than ownership and is not always disclosed up front. ` +
    `We say which is which on every project we list.</p>` +
    `<p style="color:#5b646b;font-size:14px">We pass your details to one licensed broker and nobody ` +
    `else. Reply to this email if anything changes or you'd rather we didn't.</p>` +
    `<p style="color:#5b646b;font-size:14px"><a href="${SITE}" style="color:#0b4f6c">Panama Real Estate Guide</a></p>` +
    `</div>`;

  return { subject: `We have your enquiry (${lead.reference})`, text, html };
}

async function sendClientWelcome(lead: SavedLead, input: LeadInput): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  // Phone-only leads are valid — the DB requires an email OR a phone, so there
  // is genuinely nowhere to send this for some of them.
  if (!key || !input.email) return;

  const { subject, text, html } = renderClientWelcome(lead, input);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:
        process.env.LEAD_EMAIL_FROM ??
        "Panama Real Estate Guide <hello@panamarealestateguide.com>",
      to: [input.email],
      reply_to: process.env.LEAD_REPLY_TO ?? undefined,
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
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
  const channels = ["telegram", "welcome-email", "meta", "ga4"] as const;
  const results = await Promise.allSettled([
    sendTelegramAlert(lead, input),
    sendClientWelcome(lead, input),
    sendMetaCapi(input, ip, userAgent, eventId),
    sendGa4(input, eventId),
  ]);
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      console.error(`lead ${lead.reference}: ${channels[i]} failed —`, r.reason);
    }
  }
}
