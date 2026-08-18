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

/* ── Which sections actually exist in a locale ───────────────────────────────
   A slug map says what `/de/regionen` would be called. It does not say whether
   that route has been built, and the header and footer are shared markup that
   will happily link to both trees the moment a locale is passed to them.

   Ship 1 is the four guide categories and nothing else: areas, projects, the
   about page and the contact form are all later ships (see §6 of
   docs/german-launch-plan.md). So this list is empty for German today, the
   German chrome renders guide links only, and turning a section on is one
   entry here rather than a hunt through components for hardcoded hrefs.

   Guide categories are deliberately not listed. All four exist in every locale
   by construction — a category index renders whether or not it has articles
   in that language yet. */
const LIVE_SECTIONS: Record<Locale, readonly string[]> = {
  /* `contact` is on. Lead capture is the point of the German tree, not a later
     ship — a recovered ranking that cannot be contacted is a vanity metric.
     `areas`, `projects` and `about` are still later ships. */
  de: ["contact"],
};

export const sectionIsLive = (locale: PageLocale, enSlug: string): boolean =>
  locale === "en" || LIVE_SECTIONS[locale].includes(enSlug);

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

/* ── Author credentials ──────────────────────────────────────────────────────
   `authors.credential` is one English string per author and there is exactly
   one of them in the database today. It renders in the byline next to a
   licence number, so on a German page it is a visible English leak — and the
   §7 "no English string leaks" gate would catch it, which is what it is for.

   The German wording is not invented here. It is the line settled in §7a of
   docs/german-launch-plan.md, verbatim.

   This map is keyed on the English string rather than the author slug, because
   the byline already has the credential in hand and not the slug. It wants to
   be a `credential_de` column on `authors` the moment there is a DDL path from
   this machine; until then one entry in one file beats a migration nobody can
   apply.

   An unmapped credential falls back to the English string rather than
   disappearing. A licence number is verifiable in any language and dropping it
   costs the reader more than reading it in English does — but it is a leak, so
   it should be added here rather than left to the fallback. */
const CREDENTIALS: Record<Locale, Record<string, string>> = {
  de: {
    "Panama-licensed real estate agent, licence no. PN-2753":
      "Panama-lizenzierter Immobilienmakler, Lizenz-Nr. PN-2753",
  },
};

export const credential = (locale: PageLocale, en: string): string =>
  locale === "en" ? en : (CREDENTIALS[locale][en] ?? en);

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

  /* ── Article and listing chrome ───────────────────────────────────────────
     Every string the German guide templates render around the prose. They are
     here rather than in the templates so the §9a check has one file to read,
     and so the "no English string leaks" grep in §9 has one place to fail. */
  home: string;
  onThisPage: string;
  faqHeading: string;
  sourcesHeading: string;
  sourceCheckedOn: string;
  keepReading: string;
  readMinutes: string;
  guidesCount: (n: number) => string;
  emptyCategory: string;
  emptyCategoryBody: string;
  /* Byline, per §7a of the plan. Three separate credits, never one badge:
     nobody credentialled has read the translated text. */
  writtenBy: string;
  translationCheckedBy: string;
  sourceReviewedBy: string;
  notFoundTitle: string;
  notFoundBody: string;
  notFoundLink: string;
  homeDek: string;
  homeGuidesHeading: string;
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

    home: "Start",
    onThisPage: "Auf dieser Seite",
    faqHeading: "Häufige Fragen",
    sourcesHeading: "Quellen",
    sourceCheckedOn: "geprüft am",
    keepReading: "Weiterlesen",
    /* Not "Min. Lesezeit": the English side renders a bare "8 min" and the
       German column is the same width. */
    readMinutes: "Min.",
    guidesCount: (n) => (n === 1 ? "1 Ratgeber" : `${n} Ratgeber`),
    emptyCategory: "Hier ist noch nichts auf Deutsch erschienen",
    /* Says plainly that the English article exists, because the alternative a
       reader will otherwise assume is that we have not covered the topic. The
       link itself is not offered: an English page under a German heading is
       the substitution this whole tree exists to stop. */
    emptyCategoryBody:
      "Wir übersetzen diese Rubrik gerade. Auf Englisch sind die Ratgeber bereits vollständig verfügbar.",
    writtenBy: "Geschrieben von",
    translationCheckedBy: "Deutsche Fassung geprüft von",
    sourceReviewedBy: "Original geprüft von",
    notFoundTitle: "Diese Seite gibt es nicht",
    notFoundBody:
      "Möglicherweise ist sie noch nicht auf Deutsch erschienen. Der englische Teil der Website ist vollständig.",
    notFoundLink: "Zur deutschen Startseite",
    homeDek:
      "Unabhängige Recherche zum Immobilienkauf und zum Leben in Panama. Jede Zahl mit Quelle und Prüfdatum.",
    homeGuidesHeading: "Ratgeber auf Deutsch",
  },
};

export const ui = (locale: Locale): UiStrings => UI[locale];

/* =============================================================================
   Lead capture, in German
   =============================================================================
   The whole reason for the German tree. A page that recovers a ranking and
   then has nothing to ask the reader is a vanity metric, so the German guides
   carry the same three capture blocks as the English ones, and there is a
   German contact form behind them.

   ⚠️ EVERY STRING IN THIS SECTION IS UNCHECKED GERMAN and goes through the §9a
   check with the article copy. It is the section §9 of the plan is warning
   about when it says component copy is written by whoever built the component
   and is where `du` gets in. It is `Sie` throughout, including every label,
   every placeholder, every error and the consent line.

   THE ONE LINE THAT IS NOT NEGOTIABLE is `repliesInEnglish`. Decision 6 of
   docs/localisation-plan.md: the broker takes German enquiries in English, and
   the form says so before the reader submits rather than after. Someone who
   has just read 2,500 words of German has every reason to expect a German
   call back, and finding out otherwise on the phone is a worse experience than
   reading one honest sentence next to the button.
   ============================================================================= */

export type LeadCopy = { heading: string; body: string; button: string };

/* One per category, mirroring COPY in components/article-cta.tsx. Transcreated
   rather than translated: the English buying and money blocks ask about
   finding a property, the residency and living ones ask about the move, and
   that split holds in German because it is about the reader, not the language.

   `Makler` rather than `Immobilienmakler` in the body after the first use, and
   never `Broker`, which in German reads as a securities broker. */
const LEAD_COPY: Record<Locale, Record<string, LeadCopy>> = {
  de: {
    buying: {
      heading: "Brauchen Sie einen Makler in Panama?",
      body: "Wir vermitteln Ihnen einen zugelassenen Immobilienmakler, der die Gegend wirklich bearbeitet, über die Sie gerade lesen. Er sagt Ihnen, was zum Verkauf steht, was tatsächlich dafür bezahlt wird und welche Titel sauber sind, bevor Sie sich zu irgendetwas verpflichten.",
      button: "Makler kontaktieren",
    },
    money: {
      heading: "Suchen Sie eine Immobilie in Ihrem Budget?",
      body: "Sagen Sie uns ungefähr, womit Sie rechnen, und ein zugelassener Makler meldet sich mit dem, was das wo kauft. Unverbindlich, und niemand nennt Ihnen einen Preis, bevor Sie den Titelstatus kennen.",
      button: "Makler kontaktieren",
    },
    residency: {
      heading: "Brauchen Sie Hilfe beim Umzug nach Panama?",
      body: "Ein zugelassener Makler erklärt Ihnen, wie der Aufenthaltsweg, über den Sie gerade lesen, mit Kauf oder Miete vor Ort zusammenpasst und was vor dem Umzug geregelt sein sollte.",
      button: "Hilfe beim Umzug",
    },
    living: {
      heading: "Brauchen Sie Hilfe beim Umzug nach Panama?",
      body: "Wenn Sie den Umzug noch abwägen: Ein zugelassener Makler, der hier lebt, sagt Ihnen, wie sich die Gegenden wirklich leben und was Ihr Geld in jeder davon leistet.",
      button: "Hilfe beim Umzug",
    },
  },
};

export const leadCopy = (locale: Locale, enCategory: string): LeadCopy =>
  LEAD_COPY[locale][enCategory] ?? LEAD_COPY[locale].buying;

export type LeadStrings = {
  /* Shared by all three in-guide blocks and the contact form. */
  fieldName: string;
  fieldEmail: string;
  fieldPhone: string;
  fieldCountry: string;
  honeypotLabel: string;
  privacyNote: string;
  repliesInEnglish: string;
  toFullForm: string;
  /* ── Submission errors ────────────────────────────────────────────────────
     These render on the German form itself, at the moment somebody's
     submission has just failed. An English sentence here is the worst place on
     the site to leak one: the reader is already stuck, and the message is the
     only thing telling them how to get unstuck. Passed through the URL by
     /api/lead, so they are chosen server-side at the point of failure. */
  errNeedName: string;
  errNeedContact: string;
  errBadEmail: string;
  errTurnstileFailed: string;
  errTurnstileAbsent: string;
  errRateLimited: string;
  errSaveFailed: string;
  stickyLine: string;
  stickyButton: string;

  /* The contact form. */
  contactEyebrow: string;
  contactTitle: string;
  contactDek: string;
  contactMetaTitle: string;
  contactMetaDescription: string;
  howToReachYou: string;
  howToReachYouNote: string;
  whatYouWant: string;
  whatYouWantNote: string;
  fieldBudget: string;
  fieldTimeline: string;
  fieldFinancing: string;
  fieldResidency: string;
  fieldAreas: string;
  fieldNotes: string;
  budgetOptions: readonly string[];
  timelineOptions: readonly string[];
  financingOptions: readonly string[];
  residencyOptions: readonly string[];
  areasNoPreference: string;
  moreDetail: string;
  consent: string;
  submit: string;
  whatHappensNext: string;
  nextSteps: readonly string[];
  noSelling: string;

  /* The confirmation page. */
  thanksEyebrow: string;
  thanksTitle: string;
  thanksBody: string;
  thanksReference: string;
  thanksBack: string;
};

const LEAD: Record<Locale, LeadStrings> = {
  de: {
    fieldName: "Name",
    fieldEmail: "E-Mail",
    fieldPhone: "Telefon oder WhatsApp",
    fieldCountry: "Wo Sie derzeit leben",
    /* The honeypot LABEL is German; the field NAME stays `bot-field` in every
       locale. §7 of the plan is explicit about that — renaming it per language
       would silently switch off the filter that has caught every junk lead
       this site has ever received. */
    honeypotLabel: "Dieses Feld bitte leer lassen",
    privacyNote:
      "E-Mail oder Telefon, was Ihnen lieber ist. Wir geben Ihre Daten an genau einen zugelassenen Makler weiter und an sonst niemanden. Es gibt keinen Newsletter.",
    /* Decision 6. Do not soften this and do not move it below the button. */
    repliesInEnglish:
      "Ein Hinweis vorweg: Der Makler antwortet auf Englisch. Schreiben Sie uns ruhig auf Deutsch — wir lesen es und geben es weiter, das Gespräch selbst läuft aber auf Englisch.",
    toFullForm:
      "Budget und Zeitrahmen stehen schon fest? Schicken Sie beides und Sie bekommen eine Vorauswahl →",
    errNeedName: "Bitte nennen Sie uns Ihren Namen.",
    errNeedContact:
      "Bitte hinterlassen Sie eine E-Mail-Adresse oder eine Telefonnummer, damit wir antworten können.",
    errBadEmail: "Diese E-Mail-Adresse sieht nicht richtig aus.",
    errTurnstileFailed:
      "Wir konnten die Übermittlung nicht verifizieren. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    errTurnstileAbsent:
      "Dieses Formular nutzt eine Bot-Prüfung, die JavaScript benötigt. Bitte aktivieren Sie es und versuchen Sie es erneut.",
    errRateLimited:
      "Wir haben in der letzten Stunde schon mehrere Anfragen von Ihnen — ein Makler meldet sich.",
    errSaveFailed:
      "Beim Speichern Ihrer Angaben ist etwas schiefgelaufen. Bitte versuchen Sie es noch einmal.",
    stickyLine: "Brauchen Sie einen Makler in Panama?",
    stickyButton: "Kontakt",

    contactEyebrow: "Sprechen Sie mit jemandem",
    contactTitle: "Ihre Vorauswahl anfordern",
    contactDek:
      "Ein zugelassener Makler meldet sich, in der Regel innerhalb eines Werktags. Den Titelstatus jedes Objekts auf der Liste bekommen Sie, bevor über Preise gesprochen wird.",
    contactMetaTitle: "Kontakt: Ihre Vorauswahl für Panama anfordern",
    contactMetaDescription:
      "Sagen Sie uns Budget, Zeitrahmen und was Sie vorhaben. Sie bekommen eine Vorauswahl mit dem Titelstatus jedes Objekts, geprüft im Registro Público.",
    howToReachYou: "Wie wir Sie erreichen",
    howToReachYouNote:
      "Eine E-Mail-Adresse oder eine Telefonnummer, was Ihnen lieber ist. Eines von beidem genügt.",
    whatYouWant: "Was Sie suchen",
    whatYouWantNote:
      "Mit diesen beiden Angaben können wir Gegenden für Sie ausschließen, statt Ihnen eine allgemeine Liste zu schicken.",
    fieldBudget: "Budget",
    fieldTimeline: "Zeitrahmen",
    fieldFinancing: "Barzahlung oder Finanzierung",
    fieldResidency: "Interesse am Aufenthaltstitel",
    fieldAreas: "Gegenden, die Sie in Betracht ziehen",
    fieldNotes: "Sonstiges",
    /* USD, and the figures are not converted. Panama uses the US dollar, which
       a German reader has no reason to know; the bands stay identical to the
       English form so the two sets of leads remain comparable. */
    budgetOptions: [
      "Bitte wählen",
      "Unter 150.000 USD",
      "150.000 – 300.000 USD",
      "300.000 – 600.000 USD",
      "Über 600.000 USD",
      "Noch unklar",
    ],
    timelineOptions: [
      "Bitte wählen",
      "Innerhalb von 3 Monaten",
      "3 – 12 Monate",
      "In über einem Jahr",
      "Ich informiere mich erst",
    ],
    financingOptions: [
      "Bitte wählen",
      "Barzahlung",
      "Finanzierung nötig",
      "Noch unentschieden",
    ],
    residencyOptions: [
      "Bitte wählen",
      "Ja — der Aufenthaltstitel ist ein Ziel",
      "Nein — nur der Kauf",
      "Ich möchte die Möglichkeiten verstehen",
    ],
    areasNoPreference: "Noch keine Präferenz",
    moreDetail: "Mehr Angaben machen, dann grenzen wir weiter ein",
    consent:
      "Ich bin damit einverstanden, zu meiner Anfrage kontaktiert zu werden. Wir geben Ihre Daten an genau einen zugelassenen Makler weiter und an sonst niemanden.",
    submit: "Angaben senden",
    whatHappensNext: "Wie es weitergeht",
    nextSteps: [
      "Wir lesen, was Sie geschickt haben, und schließen die Gegenden aus, die am schlechtesten passen.",
      "Sie bekommen eine Vorauswahl mit Titelstatus und Fertigstellungsterminen.",
      "Ein zugelassener Makler ruft an, um sie durchzugehen — auf Englisch.",
    ],
    noSelling:
      "Wir verkaufen Ihre Daten nicht und setzen Sie auf keine Liste, die Sie nicht angefordert haben.",

    thanksEyebrow: "Anfrage eingegangen",
    thanksTitle: "Danke — wir haben Ihre Angaben",
    thanksBody:
      "Ein zugelassener Makler meldet sich, in der Regel innerhalb eines Werktags, und das Gespräch läuft auf Englisch. Die Bestätigung per E-Mail ist ebenfalls auf Englisch.",
    thanksReference: "Ihr Vorgang",
    thanksBack: "Zurück zu den Ratgebern",
  },
};

export const lead = (locale: Locale): LeadStrings => LEAD[locale];

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
