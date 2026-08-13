/* =============================================================================
   Locales
   =============================================================================
   German first, Spanish queued. See docs/localisation-plan.md.

   English is not a `Locale`. It is the source tree, it lives at the root, and
   its URLs are byte-for-byte unchanged by any of this — that is the whole
   reason §2 of the plan chose a literal `/de` segment over a `[lang]` param.
   So the types distinguish two things that are easy to conflate:

     Locale      — a language with a translation tree. Today: "de".
     PageLocale  — any language a page can be in, English included.

   Most code wants PageLocale. Anything that reads the translation tables wants
   Locale, and the type stops it being handed "en" and querying for a row that
   by construction does not exist.

   ── Divergence from the plan, recorded deliberately ──
   §3 of the plan says the four categories get `nameEs`, `slugEs`, `blurbEs`
   and so on added to `lib/content.ts`. That was written when Spanish was the
   only locale. With a second one queued it would mean two parallel sets of
   suffixed fields on every category, and a third if we ever add one, so the
   translations live here in a per-locale map keyed by the English slug
   instead. `lib/content.ts` stays untouched and the English site keeps reading
   exactly what it read before.
   ============================================================================= */

/* Add a locale here and it starts building. Everything below is keyed off this
   array, so a missing slug map is a type error rather than a 404 discovered in
   production. Spanish joins by adding "es" plus its entries in the two maps. */
export const LOCALES = ["de"] as const;

export type Locale = (typeof LOCALES)[number];
export type PageLocale = "en" | Locale;

export const isLocale = (v: string): v is Locale =>
  (LOCALES as readonly string[]).includes(v);

/* ── Category slugs ──────────────────────────────────────────────────────────
   The four `/{category}` segments from lib/content.ts. Keyed by the English
   slug, which is the identifier the rest of the codebase already passes
   around.

   `finanzen` rather than `geld` is a register call, matching the `Sie`
   decision. Category slugs almost never rank on their own, so the search cost
   is close to zero and the tone cost of `geld` is not. */
const CATEGORY_SLUGS: Record<Locale, Record<string, string>> = {
  de: {
    buying: "kaufen",
    residency: "aufenthalt",
    money: "finanzen",
    living: "leben",
  },
};

/* ── Section slugs ───────────────────────────────────────────────────────────
   The non-category top-level routes. `areas` is deliberately not a category
   (see the note at the foot of lib/content.ts) so it belongs here.

   No umlauts or ß in any slug: transliterate ue/oe/ae/ss. Percent-encoded URLs
   are legal and every one of them is a support problem the first time somebody
   pastes it into WhatsApp. */
const SECTION_SLUGS: Record<Locale, Record<string, string>> = {
  de: {
    areas: "regionen",
    projects: "projekte",
    about: "so-arbeiten-wir",
    contact: "kontakt",
  },
};

/* ── Category names and metadata ─────────────────────────────────────────────
   Written to the ≤60 / 140–160 budgets natively in German rather than
   translated and trimmed. German compounds run long and a translated
   `metaTitle` lands at 70-plus every time. */
export type LocalisedCategory = {
  name: string;
  blurb: string;
  metaTitle: string;
  metaDescription: string;
};

const CATEGORY_COPY: Record<Locale, Record<string, LocalisedCategory>> = {
  de: {
    buying: {
      name: "Kaufen",
      blurb: "Ablauf, Verträge, Prüfung",
      metaTitle: "Immobilien in Panama kaufen: Leitfaden für Ausländer",
      metaDescription:
        "Wie Ausländer in Panama Immobilien kaufen: der Ablauf Schritt für Schritt, was der Abschluss wirklich kostet und wie Sie den Titel vorher prüfen.",
    },
    residency: {
      name: "Aufenthalt",
      blurb: "Visa, Genehmigungen, Einbürgerung",
      metaTitle: "Aufenthalt in Panama: Visa, Wege und Voraussetzungen",
      metaDescription:
        "Panamas Aufenthaltswege im Vergleich: Pensionado, Friendly Nations und Qualified Investor, die Voraussetzungen und welcher zu Ihrer Lage passt.",
    },
    money: {
      name: "Finanzen",
      blurb: "Banken, Steuern, Finanzierung",
      metaTitle: "Geld in Panama: Banken, Steuern und Lebenshaltung",
      metaDescription:
        "Konto, Grundsteuer und Alltagskosten in Panama, aufgebaut auf amtlichen Zahlen: Kontoeröffnung, Ihre Steuerlast und was ein Monat wirklich kostet.",
    },
    living: {
      name: "Leben",
      blurb: "Lebenshaltung, Gesundheit, Schulen",
      metaTitle: "Leben in Panama: Kosten, Gesundheit und Alltag",
      metaDescription:
        "Wie das Leben in Panama wirklich ist: Gesundheitsversorgung, Schulen, Mobilität und welcher Ort zu welchem Umzug passt. Jede Zahl mit Quelle.",
    },
  },
};

/* ── Chrome strings ──────────────────────────────────────────────────────────
   Header, footer and shared UI. Everything here is `Sie`, including anything
   that reads as an instruction.

   These are content, not configuration, and they go through the §9a language
   check like any other German copy. §9's "no English string leaks" grep exists
   because this is exactly the file people forget.

   ⚠️ `disclaimer` is the footer's legal notice. It makes specific claims about
   what we are not (not a licensed brokerage, not holding client funds) and it
   is the one string here that needs a second opinion beyond a language check
   before any German page ships. Flagged rather than quietly translated. */
export type UiStrings = {
  navAreas: string;
  navProjects: string;
  navAbout: string;
  navContact: string;
  ctaTalkToUs: string;
  footerGuides: string;
  footerAreas: string;
  footerAbout: string;
  footerEditorialTeam: string;
  footerBlurb: string;
  disclaimer: string;
};

const UI: Record<Locale, UiStrings> = {
  de: {
    navAreas: "Regionen",
    navProjects: "Projekte",
    navAbout: "So arbeiten wir",
    navContact: "Kontakt",
    ctaTalkToUs: "Kontakt aufnehmen",
    footerGuides: "Ratgeber",
    footerAreas: "Regionen",
    footerAbout: "Über uns",
    footerEditorialTeam: "Redaktion",
    footerBlurb:
      "Unabhängige Recherche zum Immobilienkauf in Panama. Wir nehmen kein Geld für Berichterstattung und sagen es Ihnen, wenn die ehrliche Antwort „Finger weg“ lautet.",
    disclaimer:
      "Panama Real Estate Guide veröffentlicht allgemeine Informationen, keine Rechts-, Steuer- oder Anlageberatung. Wir sind kein zugelassener Immobilienmakler und verwahren keine Kundengelder. Preise, Steuersätze und Bearbeitungszeiten ändern sich: Prüfen Sie das Verifizierungsdatum an jeder Zahl, bevor Sie sich darauf verlassen, und klären Sie Ihren Fall mit einem zugelassenen panamaischen Anwalt.",
  },
};

export const ui = (locale: Locale): UiStrings => UI[locale];

/* ── Lookups ─────────────────────────────────────────────────────────────────
   Both directions. Forward builds URLs, reverse resolves an incoming request
   back to the English identifier the data layer uses. */

export const categorySlug = (locale: Locale, enSlug: string): string =>
  CATEGORY_SLUGS[locale][enSlug] ?? enSlug;

export const sectionSlug = (locale: Locale, enSlug: string): string =>
  SECTION_SLUGS[locale][enSlug] ?? enSlug;

export const categoryCopy = (
  locale: Locale,
  enSlug: string,
): LocalisedCategory | null => CATEGORY_COPY[locale][enSlug] ?? null;

/* Reverse maps, built once. A localised segment that is not in the map returns
   null rather than falling back to itself, so `/de/buying/...` (the English
   slug under the German prefix) 404s instead of quietly rendering. Two URLs
   for one page is the duplicate-content problem hreflang exists to avoid. */
const reverse = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([en, loc]) => [loc, en]));

const CATEGORY_SLUGS_REVERSE = Object.fromEntries(
  LOCALES.map((l) => [l, reverse(CATEGORY_SLUGS[l])]),
) as Record<Locale, Record<string, string>>;

const SECTION_SLUGS_REVERSE = Object.fromEntries(
  LOCALES.map((l) => [l, reverse(SECTION_SLUGS[l])]),
) as Record<Locale, Record<string, string>>;

export const categorySlugToEn = (
  locale: Locale,
  localSlug: string,
): string | null => CATEGORY_SLUGS_REVERSE[locale][localSlug] ?? null;

export const sectionSlugToEn = (
  locale: Locale,
  localSlug: string,
): string | null => SECTION_SLUGS_REVERSE[locale][localSlug] ?? null;

/* ── Path building ───────────────────────────────────────────────────────────
   `localePath` takes an English site path and returns its equivalent in the
   target locale. English returns the path untouched, which is what makes the
   language switcher and the hreflang emitter one code path instead of two.

   It does NOT decide whether a translation exists. Callers must check that
   first: emitting hreflang for a page that has no translation is the single
   most common way these implementations break (§4). */
export function localePath(locale: PageLocale, enPath: string): string {
  if (locale === "en") return enPath;

  const segments = enPath.split("/").filter(Boolean);
  if (segments.length === 0) return `/${locale}`;

  const [head, ...rest] = segments;

  /* /areas/x, /projects/x, /about, /contact — the section keeps its own slug
     and anything below it is a proper noun that does not translate. */
  if (SECTION_SLUGS[locale][head]) {
    return `/${locale}/${[sectionSlug(locale, head), ...rest].join("/")}`;
  }

  /* /{category}/{slug} — the category translates, the article slug is written
     fresh in German and stored on the translation row, so it is passed in by
     the caller rather than derived here. */
  if (CATEGORY_SLUGS[locale][head]) {
    return `/${locale}/${[categorySlug(locale, head), ...rest].join("/")}`;
  }

  return `/${locale}/${segments.join("/")}`;
}

/* ── Document-level language signals ─────────────────────────────────────────
   Three different codes for what looks like one concept, which is a standing
   trap:

     <html lang>  — "de"
     hreflang     — "de", never "de-DE". One German version serves Germany,
                    Austria and Switzerland; a regional code tells Google to
                    suppress it in two of them.
     og:locale    — "de_DE". Open Graph does take the regional form. This is an
                    OG quirk, not an inconsistency to fix. */

export const htmlLang: Record<PageLocale, string> = {
  en: "en",
  de: "de",
};

export const hreflang: Record<PageLocale, string> = {
  en: "en",
  de: "de",
};

export const ogLocale: Record<PageLocale, string> = {
  en: "en_US",
  de: "de_DE",
};

/* ── Formatters ──────────────────────────────────────────────────────────────
   Currency is USD in every locale and is never converted. Panama uses the US
   dollar, which a German reader does not know and will otherwise assume is a
   conversion carrying exchange risk. Any page quoting a price should say so in
   words; this only handles the digits.

   The locale changes the separators, not the currency: $250,000 in English,
   250.000 USD in German. */
const INTL_LOCALE: Record<PageLocale, string> = {
  en: "en-US",
  de: "de-DE",
};

export const formatUsd = (locale: PageLocale, n: number | null): string => {
  if (n == null) return "—";
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    /* English renders "$250,000", where the reader knows which dollar. German
       defaults to "250.000 $", which does not disambiguate from the Canadian,
       Australian or Singapore dollar for a reader who does not yet know Panama
       uses the US one. "250.000 USD" is unambiguous and is what German
       financial copy uses anyway. */
    ...(locale === "en" ? {} : { currencyDisplay: "code" as const }),
  }).format(n);
};

export const formatDate = (locale: PageLocale, d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

export const formatM2 = (locale: PageLocale, n: number | null): string =>
  n == null
    ? "—"
    : `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(Math.round(n))} m²`;
