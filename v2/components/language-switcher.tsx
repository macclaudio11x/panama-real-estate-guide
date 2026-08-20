"use client";

import { useEffect, useState } from "react";
import { LOCALES, type PageLocale } from "@/lib/i18n";

/* =============================================================================
   The header language switcher
   =============================================================================
   This reads the page's OWN hreflang links rather than computing a target, and
   that is the whole design.

   Two constraints make computing it impossible here. A server layout cannot
   read the pathname — the comment in app/(de)/layout.tsx says so, and it is why
   the German tree needs its own root layout at all. And `localePath` in
   lib/i18n.ts translates the category segment but explicitly cannot derive an
   article's counterpart, because German slugs are written fresh during the SERP
   teardown and stored on the translation row. /living/retire-in-panama has no
   computable relationship to /de/leben/auswandern-nach-panama-als-rentner.

   So the switcher takes the answer from the one place that already knows it.
   lib/alternates.ts emits reciprocal hreflang on both trees, only where a
   translation actually exists, and every route already calls it. Reading those
   tags back means the switcher and the hreflang cluster cannot disagree: there
   is no second code path to drift. If alternates.ts stops emitting a pair, this
   stops offering it, without anyone remembering to change it here.

   WHY THE SERVER RENDER STILL LINKS SOMEWHERE. The markup ships with the other
   tree's home page as the href, and `useEffect` upgrades it to the true
   counterpart once the DOM is readable. That ordering is deliberate:

     - it works with JavaScript off, and for a crawler, rather than rendering a
       dead control;
     - it never shifts layout, because the element is present either way;
     - and the fallback is correct rather than merely safe. Most English pages
       have no German version yet — 2 of 49 at the time of writing — so the
       home page is genuinely where a reader asking for German should land.
       Hiding the control on those pages would leave most of the site with no
       route into the German tree at all, which defeats the launch.

   It deliberately does NOT signal "this exact page is not translated." That is
   a promise about coverage that will be wrong within a week as pages ship, and
   a switcher that renders differently per page is a switcher people stop
   trusting.
   ============================================================================= */

/** Home for each tree. The English root is "/", the German root is "/de". */
const HOME: Record<PageLocale, string> = {
  en: "/",
  ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
} as Record<PageLocale, string>;

const LABEL: Record<PageLocale, string> = { en: "EN", de: "DE" };

/** Written in the language being offered, not the one being read: this is the
 *  one control on the page addressed to someone who wants the other one. */
const TITLE: Record<PageLocale, string> = {
  en: "Read this page in English",
  de: "Diese Seite auf Deutsch lesen",
};

export function LanguageSwitcher({ locale }: { locale: PageLocale }) {
  /* Two locales today. When a third ships this becomes a list and the active
     one stops being "the other one", but a dropdown for two options is worse
     than two links, so that change waits for the third language. */
  const other: PageLocale = locale === "en" ? "de" : "en";
  const [href, setHref] = useState<string>(HOME[other]);

  useEffect(() => {
    /* Match on the reflected IDL property rather than an attribute selector.
       Next renders the attribute as `hrefLang`, and while HTML attribute names
       are case-insensitive so `[hreflang=...]` does match, the property is
       always lowercased by the parser and does not depend on that rule. */
    const link = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]'),
    ).find((el) => el.hreflang === other);
    if (!link?.href) return;

    /* Keep it same-origin. hreflang is required to be absolute and always
       names panamarealestateguide.com, so using the href as-is would send
       anyone on a Netlify deploy preview, or on localhost, to production the
       moment they switched language. Take the path and let the current origin
       stand. */
    try {
      const { pathname, search, hash } = new URL(link.href, window.location.href);
      setHref(`${pathname}${search}${hash}`);
    } catch {
      /* A malformed alternate is not worth breaking the header over: the
         fallback already points at a page that exists. */
    }
  }, [other]);

  return (
    <div
      className="flex items-center gap-1.5 font-display text-[13.5px] font-semibold"
      /* A nav landmark rather than a bare div: this is the one control that
         changes what language the whole site speaks. */
      role="navigation"
      aria-label={locale === "de" ? "Sprache" : "Language"}
    >
      {/* The current language is a status readout, and status is the first
          thing to go when space runs out. Below the nav breakpoint the control
          collapses to the language it switches TO, which is the half that is
          actually a control. Dropping it is worth 26px of a 375px header, and
          the German CTA ("Kontakt aufnehmen") needs every one of them. */}
      <span aria-current="true" className="hidden min-[1000px]:inline text-ink">
        {LABEL[locale]}
      </span>
      <span aria-hidden="true" className="hidden min-[1000px]:inline text-faint">
        ·
      </span>
      {/* Not next/link: the counterpart lives in the other root layout, so the
          document has to be replaced rather than client-navigated. A soft
          navigation would keep the current tree's <html lang> and chrome. */}
      <a
        href={href}
        hrefLang={other}
        lang={other}
        title={TITLE[other]}
        className="text-muted no-underline hover:text-brand transition-colors"
      >
        {LABEL[other]}
      </a>
    </div>
  );
}
