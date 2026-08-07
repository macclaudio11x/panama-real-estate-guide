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

/* What a conversion is worth to the bidder.
   =============================================================================
   Both ad platforms optimise towards value, so reporting one number for every
   submission teaches them to buy whichever lead is cheapest to produce. An
   unqualified enquiry off a guide is a real lead and is counted as one, but it
   closes less often than someone who arrived with a budget and a timeline, and
   the bidding should know the difference.

   ⚠️ The 50 was already a placeholder before this split, and 30 is a placeholder
   beside it. Neither is measured. Replace both with lead-to-close rates once
   there are enough closes to divide by. */
function conversionValue(intent: LeadInput["intent"]): number {
  return intent === "article" ? 30 : 50;
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
            value: conversionValue(input.intent),
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
              value: conversionValue(input.intent),
              lead_intent: input.intent,
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

async function sendTelegramAlert(
  lead: SavedLead,
  input: LeadInput,
  suspicious: string[],
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;

  const line = (label: string, value: string | null) => (value ? `${label}: ${value}\n` : "");

  /* An article lead wants a broker as much as any other, so this is still a
     call to make. What it is not is a call to make prepared: the in-guide form
     never asks for a budget or a timeline, and the second line says so plainly
     rather than leaving a blank qualifier line to be read as an evasive
     answer. */
  const header =
    input.intent === "article"
      ? `🏠 New lead: ${input.full_name}\n` +
        `From a guide — no budget or timeline asked for. Qualify on the call.\n\n`
      : `🏠 New lead: ${input.full_name}\n` +
        `${input.budget_band ?? "budget not given"} · ${input.timeline ?? "timeline not given"}\n\n`;

  /* Leads with the banner, not buries it in a field. Someone reading this on a
     phone decides whether to call in the first two lines, and "this may be
     junk" changes that decision. */
  const warning = suspicious.length
    ? `⚠️ Possible spam — ${suspicious.join(", ")}. No confirmation email was sent.\n\n`
    : "";

  const text =
    warning +
    header +
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

   ⚠️ These paths are checked against the published article list by hand. If a
   slug is ever renamed or a guide is unpublished, this email starts linking to
   404s at the exact moment a buyer's trust is newest. That is not theoretical:
   the third entry here used to be /residency/friendly-nations-2026, which has
   been a 257-word DRAFT the whole time. lib/editorial.ts filters on
   status='published', so every lead who followed it hit a 404 in the first
   email we ever sent them. Replaced with the published residency guide. */
type Guide = readonly [title: string, path: string];

const DEFAULT_GUIDES: readonly Guide[] = [
  ["Buying property in Panama, step by step", "/buying/panama-property-buying-process-guide"],
  ["Titled land vs. Rights of Possession", "/buying/titled-vs-rights-of-possession"],
  ["Panama residency: the three routes", "/residency/panama-residency-guide"],
];

/* Reading material for an article lead, chosen by what they were reading.
   =============================================================================
   Not an offer and not the reason they filled the form in — they asked for a
   broker, and the email leads with the broker. These go underneath it, because
   the gap between submitting a form and a broker picking up the phone is dead
   time that may as well be useful, and because a reader of the money guides is
   better served by the other money guides than by a generic set.

   Every path is a published guide on this site. Nothing here is gated. */
const GUIDE_SETS: Record<string, readonly Guide[]> = {
  buying: [
    ["Titled land vs. Rights of Possession", "/buying/titled-vs-rights-of-possession"],
    ["Buying property in Panama: the process, and what gets paid when", "/buying/panama-property-buying-process-guide"],
    ["Panama real estate market 2026: what's moving, and what nobody tracks", "/buying/panama-real-estate-market-2026"],
  ],
  money: [
    ["The real cost of moving to Panama", "/money/real-cost-of-moving-to-panama"],
    ["Cost of living: the official numbers, and why expat budgets differ", "/money/panama-cost-of-living-2026"],
    ["Opening a Panama bank account as a non-resident", "/money/panama-banking-non-residents-guide"],
  ],
  residency: [
    ["Panama residency: the three routes, and which threshold applies", "/residency/panama-residency-guide"],
    ["Retiring in Panama: the Pensionado threshold", "/living/retire-in-panama"],
    ["Apostille for Panama residency: what needs it, and what it costs", "/residency/apostille-documents-panama-visa"],
  ],
  living: [
    ["Living in Panama, by the official numbers", "/living/living-in-panama"],
    ["Healthcare in Panama: what CSS and the hospitals publish", "/living/panama-healthcare-costs-2026"],
    ["Is Panama safe? What the homicide statistics actually say", "/living/safety-in-panama-2026-real-data-rumors"],
  ],
};

/** The category is the first segment of the page they converted from, which the
 *  attribution component already posts. A path we can't read falls back to the
 *  default set rather than to no links. */
function guidesFor(pagePath: string | null): readonly Guide[] {
  const segment = pagePath?.split("/").filter(Boolean)[0];
  return (segment && GUIDE_SETS[segment]) || DEFAULT_GUIDES;
}

/** Exported so the copy can be rendered and read without sending anything —
 *  see scripts/preview-welcome-email.mjs. */
export function renderClientWelcome(
  lead: SavedLead,
  input: Pick<LeadInput, "full_name" | "intent" | "page_path">,
): { subject: string; text: string; html: string } {
  const firstName = input.full_name.split(" ")[0];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ── The `article` reply ──────────────────────────────────────────────────
     Someone asked for a broker from the middle of a guide. They get the same
     promise as anyone else, because they made the same request — the only
     difference is that a three-field box never asked their budget or timeline,
     so a shortlist cannot be built from what we hold.

     Rather than pretend otherwise, this says a broker is coming, names the one
     thing that would speed it up, and links the full form. The guides for
     whatever they were reading go at the bottom, as something to do while they
     wait rather than as the thing they signed up for. */
  if (input.intent === "article") {
    const guides = guidesFor(input.page_path);

    const articleText =
      `Hi ${firstName},\n\n` +
      `Thanks for getting in touch. We have your details, and your reference is ${lead.reference}.\n\n` +
      `A licensed broker will follow up, usually within one business day.\n\n` +
      `One thing that would help them: we don't yet know your budget, your timeline, or which ` +
      `part of the country you have in mind. Reply to this email with any of it, or fill in the ` +
      `longer form here and they'll arrive with a shortlist already put together:\n${SITE}/contact\n\n` +
      `Worth knowing before you speak to anyone: not all land in Panama is titled. Some is held ` +
      `under Rights of Possession, which is a weaker claim than ownership and is not always ` +
      `disclosed up front. We say which is which on every project we list.\n\n` +
      `While you wait, these are the guides that go with what you were reading:\n\n` +
      guides.map(([title, path]) => `${title}\n${SITE}${path}\n`).join("\n") +
      `\nWe pass your details to one licensed broker and nobody else, and there's no mailing ` +
      `list. Reply to this email if anything changes or you'd rather we didn't.\n\n` +
      `Panama Real Estate Guide\n${SITE}\n`;

    const articleHtml =
      `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f262b;max-width:560px">` +
      `<p>Hi ${esc(firstName)},</p>` +
      `<p>Thanks for getting in touch. We have your details, and your reference is ` +
      `<strong style="font-family:ui-monospace,monospace">${esc(lead.reference)}</strong>.</p>` +
      `<p>A licensed broker will follow up, usually within one business day.</p>` +
      `<p><strong>One thing that would help them.</strong> We don&rsquo;t yet know your budget, ` +
      `your timeline, or which part of the country you have in mind. Reply to this email with ` +
      `any of it, or fill in <a href="${SITE}/contact" style="color:#0b4f6c">the longer form</a> ` +
      `and they&rsquo;ll arrive with a shortlist already put together.</p>` +
      `<p style="border-left:3px solid #e8a33d;padding-left:14px">Worth knowing before you speak ` +
      `to anyone: not all land in Panama is titled. Some is held under Rights of Possession, ` +
      `which is a weaker claim than ownership and is not always disclosed up front. We say which ` +
      `is which on every project we list.</p>` +
      `<p><strong>While you wait</strong></p><ul>` +
      guides
        .map(
          ([title, path]) =>
            `<li><a href="${SITE}${path}" style="color:#0b4f6c">${esc(title)}</a></li>`,
        )
        .join("") +
      `</ul>` +
      `<p style="color:#5b646b;font-size:14px">We pass your details to one licensed broker and ` +
      `nobody else, and there&rsquo;s no mailing list. Reply to this email if anything changes ` +
      `or you&rsquo;d rather we didn&rsquo;t.</p>` +
      `<p style="color:#5b646b;font-size:14px"><a href="${SITE}" style="color:#0b4f6c">Panama Real Estate Guide</a></p>` +
      `</div>`;

    return {
      subject: `We have your details (${lead.reference})`,
      text: articleText,
      html: articleHtml,
    };
  }

  const GUIDES = DEFAULT_GUIDES;

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
  /** Why this submission looked like spam, from spamSignals(). Non-empty
   *  suppresses the confirmation email and nothing else — see below. */
  suspicious: string[] = [],
): Promise<void> {
  const eventId = randomUUID();
  const channels = ["telegram", "welcome-email", "meta", "ga4"] as const;

  /* Of the four, the confirmation email is the only one that sends anything to
     an address the submitter chose. The other three go to us, to Meta, and to
     Google respectively, so a junk lead costs nothing but a glance; a junk
     email costs a little of the reputation of a domain we need to keep. The
     broker still gets his Telegram alert, marked, because a lead that is
     silently dropped is a lead we cannot tell apart from one that never came. */
  const results = await Promise.allSettled([
    sendTelegramAlert(lead, input, suspicious),
    suspicious.length ? Promise.resolve() : sendClientWelcome(lead, input),
    sendMetaCapi(input, ip, userAgent, eventId),
    sendGa4(input, eventId),
  ]);
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      console.error(`lead ${lead.reference}: ${channels[i]} failed —`, r.reason);
    }
  }
}
