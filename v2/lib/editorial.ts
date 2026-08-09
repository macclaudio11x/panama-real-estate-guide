import { supabase } from "@/lib/supabase";
import type { TitleStatus } from "@/lib/content";

/* =============================================================================
   Editorial content — read from Supabase
   =============================================================================
   The synced facts (price, units, photos) still come from data/airtable.json
   via lib/content.ts — see the comment there. This file is the other half:
   the prose a human wrote, which lives only in Supabase and only appears here.

   Fetched per-slug in the three detail pages, not merged into the top-level
   `projects`/`areas`/`articles` arrays — those stay synchronous because
   listings, cards, and generateStaticParams only ever need the synced facts.
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
): Promise<ProjectEditorial | null> {
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
): Promise<AreaEditorialFull | null> {
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
  reviewer: ArticleAuthor | null;
  reviewedOn: string | null;
};

export async function getArticleFull(
  categorySlug: string,
  slug: string,
): Promise<ArticleFull | null> {
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

  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  const reviewer = Array.isArray(data.reviewer) ? data.reviewer[0] : data.reviewer;

  const toAuthor = (a: typeof author): ArticleAuthor | null =>
    a
      ? {
          name: a.name,
          title: a.title,
          bio: a.bio,
          credential: a.credential,
          avatarUrl: a.avatar_url,
        }
      : null;

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
    author: toAuthor(author),
    reviewer: toAuthor(reviewer),
    reviewedOn: data.reviewed_on,
  };
}
