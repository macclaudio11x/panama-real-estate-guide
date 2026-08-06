"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/* =============================================================================
   Mobile sticky CTA
   =============================================================================
   Mobile is the breakpoint with the least to work with: no nav menu under
   1000px, and no sidebar rail under 860px. The in-guide blocks fixed the worst
   of that, but they are still two fixed points in a nine-minute read. This is
   the one thing that stays reachable throughout.

   Mobile only. On desktop the rail is already sticky and a bar across the foot
   of a wide screen is just chrome.

   THREE RULES ABOUT WHEN IT DOES NOT APPEAR, because a bar that is always
   there is a bar people learn to ignore:

     1. Not until the reader has committed. It appears after roughly one
        screen of scrolling, so arriving on a page is not immediately met with
        a pitch.
     2. Not while a lead form is on screen. Two asks competing in one viewport
        makes both look desperate, and the form is the better one.
     3. Not over the footer. Watching for it is also what removes the need to
        pad the page: the bar is gone before the footer arrives, so it never
        covers anything.

   And not at all on /contact, where the whole page is the form.
   ============================================================================= */

/** One screenful, near enough. Below this the reader has not yet chosen to
 *  read, and interrupting them is how a CTA becomes wallpaper. */
const SHOW_AFTER_PX = 600;

export function StickyCta() {
  const pathname = usePathname();
  const [scrolledEnough, setScrolledEnough] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const suppressed = pathname.startsWith("/contact");

  useEffect(() => {
    if (suppressed) return;

    const onScroll = () => setScrolledEnough(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* Re-queried on every navigation: this component lives in the layout and
       survives route changes, so the forms it watches are not the ones it was
       watching on the previous page. */
    const targets = [
      ...document.querySelectorAll('form[action="/api/lead"]'),
      ...document.querySelectorAll("footer"),
    ];

    // Tracked per element rather than as a single boolean: with several forms
    // on an article, one scrolling out of view must not clear a flag another
    // one is still setting.
    const showing = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) showing.add(entry.target);
        else showing.delete(entry.target);
      }
      setBlocked(showing.size > 0);
    });
    targets.forEach((t) => observer.observe(t));

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [pathname, suppressed]);

  if (suppressed) return null;

  const visible = scrolledEnough && !blocked;

  return (
    <div
      /* Kept mounted and moved out of the way rather than unmounted, so it
         slides instead of appearing. `invisible` at rest keeps it off the
         focus order while it is down there. */
      className={`fixed inset-x-0 bottom-0 z-40 min-[860px]:hidden transition-[transform,visibility] duration-200 ${
        visible ? "translate-y-0 visible" : "translate-y-full invisible"
      }`}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 border-t border-white/10 bg-brand-800 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(4,32,45,0.22)]">
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-white/85">
          Need a broker in Panama?
        </p>
        <Link
          href="/contact"
          tabIndex={visible ? undefined : -1}
          className="shrink-0 rounded-sm bg-accent px-4 py-2.5 font-display text-[14.5px] font-bold text-brand-900 no-underline hover:bg-accent-600 hover:text-white transition-colors"
        >
          Talk to a broker
        </Link>
      </div>
    </div>
  );
}
