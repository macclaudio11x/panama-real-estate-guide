"use client";

import { useEffect, useState } from "react";

/* =============================================================================
   Hidden attribution fields
   =============================================================================
   The leads table has columns for utm_source, gclid, fbclid and the rest, and
   until this component existed every one of them landed null: the forms are
   plain HTML and nothing was reading the URL.

   That gap is the difference between "we got 40 leads" and "the closing-costs
   guide produced 12 of them". The columns are the easy half.

   FIRST TOUCH, NOT LAST. A visitor arrives from an ad, reads three guides over
   a fortnight, then converts from a Google search for the site by name. Reading
   the URL at submit time credits that last search and loses the ad entirely, so
   the first campaign we ever saw is stored in a cookie and reused. Anything on
   the current URL still wins — an explicit ?utm_ on the converting visit is a
   deliberate signal, not an accident.
   ============================================================================= */

const COOKIE = "prg_attr";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days, matching the GSC reporting window

const FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

type Attribution = Partial<Record<(typeof FIELDS)[number], string>>;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function firstTouch(): Attribution {
  let stored: Attribution = {};
  try {
    stored = JSON.parse(readCookie(COOKIE) ?? "{}");
  } catch {
    // A malformed cookie is not worth a thrown error on a form page.
  }

  const params = new URLSearchParams(window.location.search);
  const current: Attribution = {};
  for (const f of FIELDS) {
    const v = params.get(f);
    if (v) current[f] = v;
  }

  // Only the first campaign gets written. Once the cookie exists it is left
  // alone, which is what makes it first-touch rather than most-recent-touch.
  if (Object.keys(current).length && !Object.keys(stored).length) {
    document.cookie =
      `${COOKIE}=${encodeURIComponent(JSON.stringify(current))}; ` +
      `path=/; max-age=${MAX_AGE}; samesite=lax`;
  }

  return { ...stored, ...current };
}

/** Reads Meta's own browser-id cookie so the Conversions API can match this
 *  submission to the pixel's view of the same person. Absent when the pixel
 *  has not loaded, which is fine — CAPI degrades to hashed email and phone. */
function fbp(): string | null {
  return readCookie("_fbp");
}

/* =============================================================================
   Rejection message
   =============================================================================
   /api/lead answers a failed form post with a 303 back to the form carrying
   ?lead_error=. Reading that server-side would mean touching `searchParams`,
   which is a runtime API in Next 16 — the contact page and all 13 project
   pages would drop out of the static shell to render a message that appears
   only after a failed submit. Reading `location.search` on mount costs those
   pages nothing and shows the same text.
   ============================================================================= */

export function LeadFormError() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(new URLSearchParams(window.location.search).get("lead_error"));
  }, []);

  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-7 rounded-sm border border-line border-l-[3px] border-l-accent bg-paper-warm px-4 py-3 text-[15px] leading-relaxed text-body"
    >
      {message}
    </p>
  );
}

export function LeadAttribution() {
  // Rendered empty on the server and filled after mount: `window` does not
  // exist during prerender, and these pages are statically generated.
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const attr = firstTouch();
    setValues({
      ...attr,
      ...(fbp() ? { fbp: fbp()! } : {}),
      page_path: window.location.pathname,
      referrer: document.referrer || "",
    });
  }, []);

  return (
    <>
      {Object.entries(values)
        .filter(([, v]) => v !== "")
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
    </>
  );
}
