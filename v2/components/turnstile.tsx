"use client";

import { useEffect, useRef } from "react";

/* =============================================================================
   Cloudflare Turnstile — the widget
   =============================================================================
   Drops the challenge into a form and writes its token into a hidden
   `cf-turnstile-response` field, which lib/turnstile.ts then verifies against
   Cloudflare on the server. Both halves are needed; the widget alone proves
   nothing, since anything can POST to /api/lead directly.

   The site key is public by design — it ships in the HTML of every page this
   renders on, and Cloudflare documents it as such. The secret is the half that
   is server-only, and it never appears in this file or anything it imports.

   ── Why this renders explicitly rather than by class ──────────────────────
   The documented one-liner is a `<div class="cf-turnstile">` and a plain script
   tag: api.js scans for the class on load and fills the div in. That does not
   survive hydration here. api.js runs while React is still hydrating, renders
   into the div, and React then reconciles the div it thinks it owns and throws
   the injected iframe away — leaving an empty widget, no token, and Turnstile
   logging that it can no longer find a widget it just created.

   So the script is loaded with `render=explicit`, which stops the scan, and the
   div is filled in from an effect after React has finished with it. React never
   renders children into that div, so it has no opinion about what Turnstile
   puts there.
   ============================================================================= */

/** The widget created in the Cloudflare dashboard for panamarealestateguide.com.
 *  Changing this means changing it in the dashboard too, or every challenge
 *  starts failing its hostname check. */
const SITE_KEY = "0x4AAAAAAEItLkkSy3tFKMIu";

const API = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | undefined;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function Turnstile({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    /* api.js is async, so it may not have arrived when this first runs. Waiting
       on the script element's load event does not cover the case where it has
       already loaded and the event has been and gone, so this just looks again
       shortly. */
    const mount = () => {
      const el = box.current;
      if (!el) return;
      if (!window.turnstile) {
        retry = setTimeout(mount, 100);
        return;
      }
      // Guards the second pass of React's development double-effect, which
      // would otherwise stack two widgets in one container.
      if (el.childElementCount > 0) return;

      widgetId = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        // Kept identical to the div's data-action below: one is what Cloudflare
        // records, the other is what a reader of the markup sees.
        action: "turnstile-spin-v2",
        /* Invisible, and taking up no space, for everyone who passes silently;
           it draws itself only when Cloudflare actually wants an interaction.
           An article page renders up to three of these blocks, and three
           permanently-visible captcha boxes down one guide would be worse than
           the spam. */
        appearance: "interaction-only",
        size: "flexible",
        /* Tokens expire after five minutes. Refreshing in place means a reader
           who fills the form slowly still submits a live one. */
        "refresh-expired": "auto",
      });
    };

    mount();

    return () => {
      if (retry) clearTimeout(retry);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, []);

  return (
    <>
      {/* React 19 hoists and de-duplicates async scripts by src, so rendering
          this once per form still loads api.js exactly once per page. */}
      <script src={API} async defer />
      {/* The data-* attributes are the markup convention Cloudflare's own docs
          use and what the dashboard's analytics reads; the effect above is what
          actually renders the widget. */}
      <div
        ref={box}
        className={`cf-turnstile${className ? ` ${className}` : ""}`}
        data-sitekey={SITE_KEY}
        data-action="turnstile-spin-v2"
        data-appearance="interaction-only"
        data-size="flexible"
      />
      {/* The forms submit without JavaScript on purpose, and this is the one
          part of them that cannot. Someone with it off should know why there is
          no bot check rather than assume the form is broken. */}
      <noscript>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          This form works without JavaScript. With it on, Cloudflare checks the
          submission for bots.
        </p>
      </noscript>
    </>
  );
}
