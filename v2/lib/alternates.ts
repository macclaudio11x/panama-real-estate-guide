import { cache } from "react";
import { supabase } from "@/lib/supabase";
import { LOCALES, type Locale, categorySlug, hreflang, localePath } from "@/lib/i18n";

/* =============================================================================
   hreflang, from one place
   =============================================================================
   §4 of docs/localisation-plan.md: reciprocal `alternates.languages` on both
   trees, emitted ONLY where a translation exists, bare language codes, and
   `x-default` pointing at English.

   All of it lives here rather than in the routes, because the failure mode of
   hreflang is asymmetry — the English page names a German alternate, the
   German page names a different English one or none at all, and Google
   discards the whole cluster silently. Two routes computing the same
   relationship separately is precisely how that happens. So both call the same
   function and receive the SAME map: reciprocity stops being something to
   remember and becomes something the code cannot express otherwise.

   Three rules that look like details and are not:

   BARE CODES. `de`, never `de-DE`. One German version serves Germany, Austria
   and Switzerland; a regional code tells Google to suppress it in two of them.
   `og:locale` is the opposite and does take `de_DE` — see lib/i18n.ts.

   ABSOLUTE URLS. `metadataBase` would resolve relative ones, but hreflang is
   read by crawlers that do not always have the base in hand, and every
   published example of this going wrong involves a relative href.

   ONLY WHERE A TRANSLATION EXISTS. A hreflang tag pointing at a URL that 404s,
   or that 301s somewhere else, is worse than no tag: the first is a broken
   promise and the second is discarded. The redirect half of that is a live
   hazard in this repo, since the stopgap 301s share the /de/ prefix with the
   new tree — every URL emitted here must be checked against netlify.toml.
   ============================================================================= */

const SITE_BASE = "https://panamarealestateguide.com";

/* "/" becomes the bare origin, not `${SITE_BASE}/`. That is what Next renders
   into the canonical and what it normalises an alternate to, and hreflang is
   cross-checked against the sitemap: two spellings of the home page across the
   two artefacts is the kind of disagreement that gets a cluster ignored. They
   are the same URL to a crawler, but only one of them is the one we emit. */
const abs = (path: string) => (path === "/" ? SITE_BASE : `${SITE_BASE}${path}`);

/** What Next wants in `alternates`. `languages` is omitted entirely rather
 *  than set to an empty object when a page stands alone, so a page with no
 *  translation emits no alternate links at all. */
export type Alternates = {
  canonical: string;
  languages?: Record<string, string>;
};

/* =============================================================================
   Which articles exist in which languages
   =============================================================================
   One query, cached per render pass, answering both directions at once: the
   English route needs "what is this article's German slug", the German route
   needs "what English article is this", and the sitemap needs every pair.

   The article slug is the only part of the URL that differs unpredictably
   between languages — the category segment is a fixed map in lib/i18n.ts and
   the German slug is written fresh during the SERP teardown rather than
   derived from the English one. So the pair is the unit worth storing.
   ============================================================================= */

export type TranslationPair = {
  lang: Locale;
  /** English category slug — the identifier the whole codebase passes around. */
  categorySlug: string;
  enSlug: string;
  localSlug: string;
};

type PairRow = {
  lang: string;
  slug: string;
  article:
    | { slug: string; status: string; category: { slug: string } | { slug: string }[] | null }
    | { slug: string; status: string; category: { slug: string } | { slug: string }[] | null }[]
    | null;
};

export const listTranslationPairs = cache(async (): Promise<TranslationPair[]> => {
  const { data, error } = await supabase
    .from("article_translations")
    .select(
      `lang, slug,
       article:articles!article_translations_article_id_fkey (
         slug, status,
         category:categories!articles_category_id_fkey ( slug )
       )`,
    )
    .eq("status", "published");

  if (error || !data) return [];

  return (data as PairRow[])
    .map((r) => {
      const article = Array.isArray(r.article) ? r.article[0] : r.article;
      /* An orphaned translation of an unpublished article is not a page, so it
         is not an alternate either. Emitting hreflang for it would point at a
         404 — the exact failure this module exists to prevent. */
      if (!article || article.status !== "published") return null;
      const cat = Array.isArray(article.category) ? article.category[0] : article.category;
      if (!cat) return null;
      if (!(LOCALES as readonly string[]).includes(r.lang)) return null;
      return {
        lang: r.lang as Locale,
        categorySlug: cat.slug,
        enSlug: article.slug,
        localSlug: r.slug,
      };
    })
    .filter((p): p is TranslationPair => p !== null);
});

/* ── URL shapes ────────────────────────────────────────────────────────────*/

export const enArticlePath = (categorySlug: string, slug: string) =>
  `/${categorySlug}/${slug}`;

export const localeArticlePath = (
  locale: Locale,
  enCategorySlug: string,
  localSlug: string,
) => `/${locale}/${categorySlug(locale, enCategorySlug)}/${localSlug}`;

/* =============================================================================
   The two builders
   =============================================================================
   Both return the same `languages` map for a given article or section. The
   only thing that differs between the English and German call is which URL is
   canonical, which is the entire correct implementation of reciprocal
   hreflang.
   ============================================================================= */

/** The shared language map for one article, or null when it exists in English
 *  only. `x-default` is English: it is the source tree and the fallback for
 *  every language we do not publish. */
function articleLanguages(
  pairs: TranslationPair[],
  categorySlug: string,
  enSlug: string,
): Record<string, string> | null {
  const mine = pairs.filter(
    (p) => p.categorySlug === categorySlug && p.enSlug === enSlug,
  );
  if (mine.length === 0) return null;

  const enUrl = abs(enArticlePath(categorySlug, enSlug));
  const languages: Record<string, string> = {
    [hreflang.en]: enUrl,
    "x-default": enUrl,
  };
  for (const p of mine) {
    languages[hreflang[p.lang]] = abs(
      localeArticlePath(p.lang, p.categorySlug, p.localSlug),
    );
  }
  return languages;
}

/** For the English article route. */
export async function alternatesForEnArticle(
  categorySlug: string,
  slug: string,
): Promise<Alternates> {
  const languages = articleLanguages(await listTranslationPairs(), categorySlug, slug);
  return {
    canonical: enArticlePath(categorySlug, slug),
    ...(languages && { languages }),
  };
}

/** For a translated article route. Returns null when the row this URL was
 *  built from has gone — the caller is already 404ing in that case. */
export async function alternatesForTranslatedArticle(
  locale: Locale,
  enCategorySlug: string,
  localSlug: string,
): Promise<Alternates | null> {
  const pairs = await listTranslationPairs();
  const mine = pairs.find(
    (p) => p.lang === locale && p.categorySlug === enCategorySlug && p.localSlug === localSlug,
  );
  if (!mine) return null;

  return {
    canonical: localeArticlePath(locale, enCategorySlug, localSlug),
    /* Non-null by construction: `mine` is in the list the map is built from. */
    languages: articleLanguages(pairs, mine.categorySlug, mine.enSlug)!,
  };
}

/* =============================================================================
   Sections that exist in every locale by construction
   =============================================================================
   The home page, the four category indexes and the contact form. These need no
   database lookup: a German category index renders whether or not it has
   articles yet, so the counterpart is always there and the pairing is a pure
   function of the path.

   Areas, projects and the about page are deliberately NOT here. They are
   English-only today, and a page with one alternate that is itself is not a
   cluster — it is noise that will be wrong the day /de/regionen ships.
   ============================================================================= */

export function alternatesForSection(
  enPath: string,
  currentLocale: "en" | Locale = "en",
): Alternates {
  const enUrl = abs(enPath);
  const languages: Record<string, string> = {
    [hreflang.en]: enUrl,
    "x-default": enUrl,
  };
  for (const l of LOCALES) {
    languages[hreflang[l]] = abs(localePath(l, enPath));
  }

  return {
    canonical: currentLocale === "en" ? enPath : localePath(currentLocale, enPath),
    languages,
  };
}
