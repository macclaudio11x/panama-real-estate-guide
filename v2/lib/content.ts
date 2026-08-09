import airtable from "@/data/airtable.json";
import { normalizeAmenities } from "@/lib/amenities";

/* =============================================================================
   Content model — v2
   =============================================================================
   Two layers, deliberately separate:

   SYNCED    data/airtable.json — projects, photos, prices, unit models. Written
             by scripts/sync-airtable.mjs. Developer-supplied, never edited here.
   EDITORIAL the overlays below — title status, positioning, climate, and the
             guides. Authored by us, never synced, and null until researched.

   The split is the point. Synced facts come from the developer and are labelled
   as such; editorial claims carry our name. Merging them would make it
   impossible to say which is which, and this whole site is a bet on that
   distinction being visible.
   ============================================================================= */

export type TitleStatus = "titled" | "rop" | "mixed" | "unknown";

/* ── Editorial overlay ──────────────────────────────────────────────────────
   Every field here is null until a human researches it. Templates hide null
   fields rather than showing filler. Cards stay sparse on purpose — a sparse
   card built from real data beats a full one built from guesses.

   ⚠️ titleStatus is "unknown" for all 15 areas. Whether land in an area is
   titled or Rights of Possession is the central claim of this site, Airtable
   has no field for it, and nobody has checked. Do not set these from general
   knowledge — each one needs a real source. */
type AreaEditorial = {
  titleStatus: TitleStatus;
  titleNote: string | null;
  positioning: string | null;
  elevationM: number | null;
  climate: string | null;
  verifiedOn: string | null;
};

const BLANK: AreaEditorial = {
  titleStatus: "unknown",
  titleNote: null,
  positioning: null,
  elevationM: null,
  climate: null,
  verifiedOn: null,
};

const AREA_EDITORIAL: Record<string, AreaEditorial> = {
  "costa-del-este": { ...BLANK },
  "santa-maria": { ...BLANK },
  boquete: { ...BLANK },
  marbella: { ...BLANK },
  amador: { ...BLANK },
  "playa-venao": { ...BLANK },
  "punta-pacifica": { ...BLANK },
  sora: { ...BLANK },
  bijao: { ...BLANK },
  "playa-bonita": { ...BLANK },
  buenaventura: { ...BLANK },
  obarrio: { ...BLANK },
  "playa-caracol": { ...BLANK },
  "rio-hato": { ...BLANK },
  portobelo: { ...BLANK },
  "bocas-del-toro": { ...BLANK },
};

/* ── Synced shapes ──────────────────────────────────────────────────────────*/

export type UnitModel = {
  name: string | null;
  beds: number | null;
  baths: number | null;
  sizeM2: number | null;
  priceFromUsd: number | null;
};

export type Photo = { src: string; alt: string | null };

export type Project = {
  slug: string;
  name: string;
  areaSlug: string;
  published: boolean;
  status: "preselling" | "under-construction" | "delivered" | null;
  priceFromUsd: number | null;
  priceToUsd: number | null;
  bedsMin: number | null;
  bedsMax: number | null;
  sizeFromM2: number | null;
  descriptionEn: string | null;
  amenities: string[];
  websiteUrl: string | null;
  rawLocation: string | null;
  models: UnitModel[];
  photos: Photo[];
  dataSource: string;
};

export type Area = AreaEditorial & {
  slug: string;
  name: string;
  region: string;
  projectCount: number;
  priceFromUsd: number | null;
  priceToUsd: number | null;
  photo: string | null;
};

/* ── Merge ──────────────────────────────────────────────────────────────────*/

/* Only what a visitor may see. `published` mirrors "Publicado en Web", and the
   Supabase RLS policy is `using (published)` — so reading everything here would
   show 18 projects publicly that vanish the moment the data source changes.
   The flag is the editorial control; the code just honours it. */
const clean = (p: Project): Project => ({
  ...p,
  // Amenities arrive as raw Spanish developer copy and the sync overwrites any
  // fix made in the JSON, so the cleanup has to happen here. See lib/amenities.
  amenities: normalizeAmenities(p.amenities),
});

export const projects = (airtable.projects as Project[])
  .filter((p) => p.published)
  .map(clean);

/** Every project including unpublished. For internal tooling only — never
 *  render these. */
export const allProjects = (airtable.projects as Project[]).map(clean);

export const areas: Area[] = airtable.areas.map((a) => {
  const inArea = projects.filter((p) => p.areaSlug === a.slug);

  // Derived from published inventory, not from the sync's totals. Quoting a
  // price from a project a visitor cannot open is worse than quoting none.
  const froms = inArea
    .map((p) => p.priceFromUsd)
    .filter((n): n is number => typeof n === "number");
  const tops = inArea
    .map((p) => p.priceToUsd ?? p.priceFromUsd)
    .filter((n): n is number => typeof n === "number");

  return {
    ...(AREA_EDITORIAL[a.slug] ?? BLANK),
    slug: a.slug,
    name: a.name,
    region: a.region,
    projectCount: inArea.length,
    priceFromUsd: froms.length ? Math.min(...froms) : null,
    priceToUsd: tops.length ? Math.max(...tops) : null,
    // Borrow the first project photo as the area's cover until we have
    // dedicated area photography.
    photo: inArea.find((p) => p.photos.length)?.photos[0]?.src ?? null,
  };
});

/* ── Editorial: people, categories, guides ──────────────────────────────────*/

export type Author = {
  slug: string;
  name: string;
  title: string;
  bio: string;
  credential: string | null;
  isReviewer: boolean;
};

/* `blurb` is the on-page label under the category name and is deliberately
   terse. `metaTitle` and `metaDescription` are what search results show, where
   the budgets are ~60 and ~160 characters and the copy has to stand alone
   without the page around it. The old shared formula, "{name} guides for
   buying property in Panama", was also wrong on three of the four: residency,
   money and living are not about buying property. */
export type Category = {
  slug: string;
  name: string;
  blurb: string;
  metaTitle: string;
  metaDescription: string;
};

export const categories: Category[] = [
  {
    slug: "buying",
    name: "Buying",
    blurb: "Process, contracts, due diligence",
    metaTitle: "Buying Property in Panama: Guides for Foreign Buyers",
    metaDescription:
      "How to buy property in Panama as a foreigner: the process step by step, what closing actually costs, and how to check title before you commit.",
  },
  {
    slug: "residency",
    name: "Residency",
    blurb: "Visas, permits, citizenship",
    metaTitle: "Panama Residency: Visas, Permits and Requirements",
    metaDescription:
      "Panama's residency routes compared: the Pensionado, Friendly Nations and Qualified Investor visas, what each one requires, and which fits your situation.",
  },
  {
    slug: "money",
    name: "Money",
    blurb: "Banking, taxes, financing",
    metaTitle: "Money in Panama: Banking, Taxes and Cost of Living",
    metaDescription:
      "Banking, property taxes and everyday costs in Panama, built from official figures: opening an account, what you owe, and what a month really runs.",
  },
  {
    slug: "living",
    name: "Living",
    blurb: "Cost of living, healthcare, schools",
    metaTitle: "Living in Panama: Costs, Healthcare and Daily Life",
    metaDescription:
      "What living in Panama is actually like: healthcare you can join, schools, getting around, and which towns suit which kind of move. Every figure sourced.",
  },
];
// NB: "areas" is deliberately not a category. /areas/[slug] is its own route,
// and a category of the same name would collide with it under /[category]/[slug].

export const authors: Author[] = [
  {
    slug: "editorial-team",
    name: "Editorial Team",
    title: "Panama Real Estate Guide",
    bio: "We research and write every guide on this site, and we do not accept payment for coverage.",
    credential: null,
    isReviewer: false,
  },
  {
    slug: "legal-reviewer",
    name: "Legal Reviewer",
    title: "Panamanian attorney",
    bio: "Reviews every guide that touches title, tax, or residency law before it publishes.",
    credential: "Placeholder — needs a named, licensed reviewer before launch",
    isReviewer: true,
  },
];

/* Articles are NOT here. The index moved to lib/articles.ts, which reads the
   live `articles` table — see the header comment there for why. `categories`
   and `authors` stay hardcoded because they are structural: four categories and
   two bylines change on a schema timescale, not an editorial one. */

/* The homepage `figures` strip is gone. It was four invented numbers rendered
   as a stat row under gold VERIFIED stamps — both the most generic shape on
   the page and the last thing on the site asserting something unsourced. If
   figures like transfer tax and Friendly Nations minimums come back, they need
   real sources first, and a form that isn't four tiles in a row. */

/* ── Lookups ────────────────────────────────────────────────────────────────*/

export const getArea = (slug: string) => areas.find((a) => a.slug === slug);

export const getProjectsForArea = (slug: string) =>
  projects.filter((p) => p.areaSlug === slug);

export const getProject = (slug: string) =>
  projects.find((p) => p.slug === slug);

export const getAuthor = (slug: string) => authors.find((a) => a.slug === slug);

export const usd = (n: number | null) => {
  if (n == null) return "—";
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2).replace(/0$/, "")}M`
    : `$${Math.round(n / 1000)}k`;
};

/** Airtable stores areas as raw floats (157.11203). Round for display. */
export const m2 = (n: number | null) => (n == null ? "—" : `${Math.round(n)} m²`);

export const titleLabel: Record<TitleStatus, string> = {
  titled: "Titled",
  rop: "Rights of possession",
  mixed: "Mixed — verify",
  unknown: "Title not checked",
};

export const statusLabel = {
  preselling: "Preselling",
  "under-construction": "Under construction",
  delivered: "Delivered",
} as const;
