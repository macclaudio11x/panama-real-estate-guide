import { supabase } from "@/lib/supabase";
import type { TitleStatus } from "@/lib/content";
import type { PageLocale } from "@/lib/i18n";

/* =============================================================================
   Editorial content — read from Supabase
   =============================================================================
   The catalog facts (price, units, photos) come from lib/catalog.ts. This file
   is the other half: the long-form prose a human wrote.

   Both now read Supabase, but they stay separate because they are fetched
   differently. The catalog is listed in bulk for cards, listings and
   generateStaticParams; this is fetched per-slug in the detail pages only,
   since no listing needs a project's buying_note or an area's FAQ block.
   ============================================================================= */

export type Faq = { q: string; a: string };
export type SourceRef = { label: string; url: string; checkedOn: string | null };

type TitleClaim = {
  titleStatus: TitleStatus;
  titleNote: string | null;
  titleSourceUrl: string | null;
  titleVerifiedOn: string | null;
  titleVerifiedByName: string | null;
};

export type ProjectEditorial = TitleClaim & {
  hook: string | null;
  architect: string | null;
  storeys: number | null;
  totalUnits: number | null;
  phases: number | null;
  locationNote: string | null;
  suits: string | null;
  drawbacks: string | null;
  buyingNote: string | null;
  faqs: Faq[];
  priceSourceUrl: string | null;
  priceCheckedOn: string | null;
};

export async function getProjectEditorial(
  slug: string,
  locale: PageLocale = "en",
): Promise<ProjectEditorial | null> {
  if (locale !== "en") return getProjectTranslation(slug, locale);

  const { data, error } = await supabase
    .from("projects")
    .select(
      `hook, architect, storeys, total_units, phases,
       location_note, suits, drawbacks, buying_note, faqs,
       price_source_url, price_checked_on,
       title_status, title_note, title_source_url, title_verified_on,
       title_verified_by:authors ( name )`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const verifier = Array.isArray(data.title_verified_by)
    ? data.title_verified_by[0]
    : data.title_verified_by;

  return {
    hook: data.hook,
    architect: data.architect,
    storeys: data.storeys,
    totalUnits: data.total_units,
    phases: data.phases,
    locationNote: data.location_note,
    suits: data.suits,
    drawbacks: data.drawbacks,
    buyingNote: data.buying_note,
    faqs: (data.faqs as Faq[]) ?? [],
    priceSourceUrl: data.price_source_url,
    priceCheckedOn: data.price_checked_on,
    titleStatus: data.title_status,
    titleNote: data.title_note,
    titleSourceUrl: data.title_source_url,
    titleVerifiedOn: data.title_verified_on,
    titleVerifiedByName: verifier?.name ?? null,
  };
}

export type AreaEditorialFull = TitleClaim & {
  positioning: string | null;
  blurb: string | null;
  costOfLivingNote: string | null;
  gettingAroundNote: string | null;
  suits: string | null;
  drawbacks: string | null;
  faqs: Faq[];
  sources: SourceRef[];
};

export async function getAreaEditorialFull(
  slug: string,
  locale: PageLocale = "en",
): Promise<AreaEditorialFull | null> {
  /* Same rule E1 set for articles: a missing translation returns null and the
     route 404s. It never falls back to English, because a German URL quietly
     serving English prose is how the withdrawn /de/ tree passed unnoticed. */
  if (locale !== "en") return getAreaTranslation(slug, locale);

  const { data, error } = await supabase
    .from("areas")
    .select(
      `positioning, blurb, cost_of_living_note, getting_around_note,
       suits, drawbacks, faqs, sources,
       title_status, title_note, title_source_url, title_verified_on,
       title_verified_by:authors ( name )`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const verifier = Array.isArray(data.title_verified_by)
    ? data.title_verified_by[0]
    : data.title_verified_by;

  return {
    positioning: data.positioning,
    blurb: data.blurb,
    costOfLivingNote: data.cost_of_living_note,
    gettingAroundNote: data.getting_around_note,
    suits: data.suits,
    drawbacks: data.drawbacks,
    faqs: (data.faqs as Faq[]) ?? [],
    sources: (data.sources as SourceRef[]) ?? [],
    titleStatus: data.title_status,
    titleNote: data.title_note,
    titleSourceUrl: data.title_source_url,
    titleVerifiedOn: data.title_verified_on,
    titleVerifiedByName: verifier?.name ?? null,
  };
}

/* =============================================================================
   Translated areas and projects
   =============================================================================
   Two rules decide what comes from where, and both follow migration 0014.

   PROSE IS TRANSLATED, EVIDENCE IS NOT. `title_note` is an argument written for
   a reader and lives on the translation row. `title_status`, the source URL,
   the verification date and the verifier's name are facts about the Registro
   Público, identical in every language, and stay on the English row. Copying
   them would create a second place for a title claim to be wrong.

   SOURCES ARE SHARED, deliberately, exactly as 0013 argued for articles: both
   language versions cite the same primary documents, most of them Spanish
   government PDFs whatever language the page is written in, and one array is
   the only way a corrected citation reaches every language at once. So
   `area_translations` has no sources column and the English row supplies them.

   `published` on the translation is the gate. It is separate from the parent's
   own publish state because a half-translated area must render not at all
   rather than half in English.
   ============================================================================= */

type AreaTranslationRow = {
  positioning: string | null;
  blurb: string | null;
  cost_of_living_note: string | null;
  getting_around_note: string | null;
  suits: string | null;
  drawbacks: string | null;
  title_note: string | null;
  faqs: Faq[] | null;
  area:
    | { sources: SourceRef[] | null; title_status: TitleStatus; title_source_url: string | null;
        title_verified_on: string | null; title_verified_by: { name: string } | { name: string }[] | null }
    | { sources: SourceRef[] | null; title_status: TitleStatus; title_source_url: string | null;
        title_verified_on: string | null; title_verified_by: { name: string } | { name: string }[] | null }[]
    | null;
};

async function getAreaTranslation(
  slug: string,
  locale: Exclude<PageLocale, "en">,
): Promise<AreaEditorialFull | null> {
  const { data, error } = await supabase
    .from("area_translations")
    .select(
      `positioning, blurb, cost_of_living_note, getting_around_note,
       suits, drawbacks, title_note, faqs,
       area:areas!area_translations_area_id_fkey!inner (
         slug, sources, title_status, title_source_url, title_verified_on,
         title_verified_by:authors ( name )
       )`,
    )
    .eq("lang", locale)
    .eq("published", true)
    .eq("areas.slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as AreaTranslationRow;
  const area = Array.isArray(row.area) ? row.area[0] : row.area;
  if (!area) return null;

  const verifier = Array.isArray(area.title_verified_by)
    ? area.title_verified_by[0]
    : area.title_verified_by;

  return {
    positioning: row.positioning,
    blurb: row.blurb,
    costOfLivingNote: row.cost_of_living_note,
    gettingAroundNote: row.getting_around_note,
    suits: row.suits,
    drawbacks: row.drawbacks,
    faqs: row.faqs ?? [],
    sources: area.sources ?? [],
    titleStatus: area.title_status,
    titleNote: row.title_note,
    titleSourceUrl: area.title_source_url,
    titleVerifiedOn: area.title_verified_on,
    titleVerifiedByName: verifier?.name ?? null,
  };
}

/** Slugs with a published translation in `locale`. This is what the German
 *  routes hand to `generateStaticParams` and what the index filters on, so an
 *  untranslated area is not merely 404 on arrival but never linked at all. */
export async function listTranslatedSlugs(
  surface: "area" | "project",
  locale: Exclude<PageLocale, "en">,
): Promise<string[]> {
  const table = surface === "area" ? "area_translations" : "project_translations";
  const parent = surface === "area" ? "areas" : "projects";
  const fk =
    surface === "area"
      ? "areas!area_translations_area_id_fkey!inner"
      : "projects!project_translations_project_id_fkey!inner";

  const { data, error } = await supabase
    .from(table)
    .select(`parent:${fk} ( slug )`)
    .eq("lang", locale)
    .eq("published", true);

  if (error || !data) return [];

  return (data as { parent: { slug: string } | { slug: string }[] | null }[])
    .map((r) => (Array.isArray(r.parent) ? r.parent[0] : r.parent))
    .map((p) => p?.slug)
    .filter((s): s is string => Boolean(s))
    .sort();
}

type ProjectTranslationRow = {
  hook: string | null;
  location_note: string | null;
  suits: string | null;
  drawbacks: string | null;
  buying_note: string | null;
  title_note: string | null;
  faqs: Faq[] | null;
  project:
    | ProjectFacts
    | ProjectFacts[]
    | null;
};

type ProjectFacts = {
  architect: string | null;
  storeys: number | null;
  total_units: number | null;
  phases: number | null;
  price_source_url: string | null;
  price_checked_on: string | null;
  title_status: TitleStatus;
  title_source_url: string | null;
  title_verified_on: string | null;
  title_verified_by: { name: string } | { name: string }[] | null;
};

async function getProjectTranslation(
  slug: string,
  locale: Exclude<PageLocale, "en">,
): Promise<ProjectEditorial | null> {
  const { data, error } = await supabase
    .from("project_translations")
    .select(
      `hook, location_note, suits, drawbacks, buying_note, title_note, faqs,
       project:projects!project_translations_project_id_fkey!inner (
         slug, architect, storeys, total_units, phases,
         price_source_url, price_checked_on,
         title_status, title_source_url, title_verified_on,
         title_verified_by:authors ( name )
       )`,
    )
    .eq("lang", locale)
    .eq("published", true)
    .eq("projects.slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as ProjectTranslationRow;
  const p = Array.isArray(row.project) ? row.project[0] : row.project;
  if (!p) return null;

  const verifier = Array.isArray(p.title_verified_by)
    ? p.title_verified_by[0]
    : p.title_verified_by;

  return {
    hook: row.hook,
    /* Structural, not prose: an architect's name and a storey count read the
       same in German. */
    architect: p.architect,
    storeys: p.storeys,
    totalUnits: p.total_units,
    phases: p.phases,
    locationNote: row.location_note,
    suits: row.suits,
    drawbacks: row.drawbacks,
    buyingNote: row.buying_note,
    faqs: row.faqs ?? [],
    priceSourceUrl: p.price_source_url,
    priceCheckedOn: p.price_checked_on,
    titleStatus: p.title_status,
    titleNote: row.title_note,
    titleSourceUrl: p.title_source_url,
    titleVerifiedOn: p.title_verified_on,
    titleVerifiedByName: verifier?.name ?? null,
  };
}

export type ArticleAuthor = {
  name: string;
  title: string | null;
  bio: string | null;
  credential: string | null;
  avatarUrl: string | null;
};

export type ArticleFull = {
  title: string;
  dek: string | null;
  /* Search metadata. Null means "use title/dek" — see migration 0007. Only set
     when a page wants its search result to differ from its headline. */
  seoTitle: string | null;
  metaDescription: string | null;
  body: string | null;
  faqs: Faq[];
  sources: SourceRef[];
  readMinutes: number | null;
  ogImagePath: string | null;
  author: ArticleAuthor | null;
  /* The credentialled signature, and an E-E-A-T claim to the reader: this
     person read THIS page. Only ever set on an English row. On a translation
     it stays null, because nobody credentialled has read the translated text —
     see `sourceReviewer` for the honest version of that credit. */
  reviewer: ArticleAuthor | null;
  reviewedOn: string | null;

  /* ── Translation-only fields ───────────────────────────────────────────────
     Null on English rows. Together these render the byline settled in
     docs/german-launch-plan.md §7a: written by X, German checked by Y,
     original reviewed by Z. The "✓ Reviewed for accuracy" badge and the
     JSON-LD `reviewedBy` are deliberately NOT driven by these, because both
     assert that a credentialled reviewer read this page.
     ------------------------------------------------------------------------ */
  locale: PageLocale;
  translator: ArticleAuthor | null;
  /* Who signed the ENGLISH source. Rendered as "Original geprüft von …",
     never as a review of the translation. */
  sourceReviewer: ArticleAuthor | null;
  sourceReviewedOn: string | null;
};

/* The columns every author join needs. One string so the English and
   translation queries cannot drift apart. */
const AUTHOR_COLS = "name, title, bio, credential, avatar_url";

type AuthorRow = {
  name: string;
  title: string | null;
  bio: string | null;
  credential: string | null;
  avatar_url: string | null;
} | null;

const one = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const toAuthor = (a: AuthorRow): ArticleAuthor | null =>
  a
    ? {
        name: a.name,
        title: a.title,
        bio: a.bio,
        credential: a.credential,
        avatarUrl: a.avatar_url,
      }
    : null;

/* =============================================================================
   Translated articles
   =============================================================================
   A translated page is the same article in another language, not a different
   article. So the facts that are language-neutral — sources, cover image,
   reading time, and who signed the original — are read from the English row
   and never duplicated. Only the prose comes from `article_translations`.

   THE RULE THAT MATTERS: a missing translation returns null. It never falls
   back to the English row. A `/de/` URL serving English text under an hreflang
   tag claiming German is duplicate content and a bad answer at the same time,
   and it is exactly what the machine-translated tree did before it was
   withdrawn.
   ============================================================================= */
async function getArticleTranslation(
  locale: Exclude<PageLocale, "en">,
  categorySlug: string,
  slug: string,
): Promise<ArticleFull | null> {
  const { data, error } = await supabase
    .from("article_translations")
    .select(
      `title, dek, seo_title, meta_description, body, faqs,
       translator:authors!article_translations_translator_id_fkey ( ${AUTHOR_COLS} ),
       article:articles!article_translations_article_id_fkey (
         sources, read_minutes, og_image_path, status, reviewed_on,
         category:categories!articles_category_id_fkey ( slug ),
         author:authors!articles_author_id_fkey ( ${AUTHOR_COLS} ),
         reviewer:authors!articles_reviewer_id_fkey ( ${AUTHOR_COLS} )
       )`,
    )
    .eq("lang", locale)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;

  const article = one(data.article as never) as {
    sources: SourceRef[] | null;
    read_minutes: number | null;
    og_image_path: string | null;
    status: string;
    reviewed_on: string | null;
    category: { slug: string } | { slug: string }[] | null;
    author: AuthorRow | AuthorRow[];
    reviewer: AuthorRow | AuthorRow[];
  } | null;

  /* An orphaned translation of an unpublished or recategorised article is a
     404, not a page. Publishing the German while the English is a draft would
     put the translation ahead of a source nobody has approved. */
  if (!article || article.status !== "published") return null;
  if (one(article.category)?.slug !== categorySlug) return null;

  return {
    title: data.title,
    dek: data.dek,
    seoTitle: data.seo_title,
    metaDescription: data.meta_description,
    body: data.body,
    faqs: (data.faqs as Faq[]) ?? [],
    /* Shared, never translated. Source titles stay in their own language so a
       reader can find the document; the gloss around them is the writer's job. */
    sources: article.sources ?? [],
    readMinutes: article.read_minutes,
    ogImagePath: article.og_image_path,
    author: toAuthor(one(article.author)),
    reviewer: null,
    reviewedOn: null,
    locale,
    translator: toAuthor(one(data.translator as never)),
    sourceReviewer: toAuthor(one(article.reviewer)),
    sourceReviewedOn: article.reviewed_on,
  };
}

export async function getArticleFull(
  categorySlug: string,
  slug: string,
  locale: PageLocale = "en",
): Promise<ArticleFull | null> {
  if (locale !== "en") {
    return getArticleTranslation(locale, categorySlug, slug);
  }
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .maybeSingle();
  if (!category) return null;

  const { data, error } = await supabase
    .from("articles")
    .select(
      `title, dek, seo_title, meta_description, body, faqs, sources, read_minutes, reviewed_on, og_image_path,
       author:authors!articles_author_id_fkey ( name, title, bio, credential, avatar_url ),
       reviewer:authors!articles_reviewer_id_fkey ( name, title, bio, credential, avatar_url )`,
    )
    .eq("category_id", category.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;

  return {
    title: data.title,
    dek: data.dek,
    seoTitle: data.seo_title,
    metaDescription: data.meta_description,
    body: data.body,
    faqs: (data.faqs as Faq[]) ?? [],
    sources: (data.sources as SourceRef[]) ?? [],
    readMinutes: data.read_minutes,
    ogImagePath: data.og_image_path,
    author: toAuthor(one(data.author as never)),
    reviewer: toAuthor(one(data.reviewer as never)),
    reviewedOn: data.reviewed_on,
    locale: "en",
    translator: null,
    sourceReviewer: null,
    sourceReviewedOn: null,
  };
}
