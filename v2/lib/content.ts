import airtable from "@/data/airtable.json";

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
export const projects = (airtable.projects as Project[]).filter(
  (p) => p.published,
);

/** Every project including unpublished. For internal tooling only — never
 *  render these. */
export const allProjects = airtable.projects as Project[];

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

export type Category = { slug: string; name: string; blurb: string };

export type Article = {
  slug: string;
  categorySlug: string;
  title: string;
  dek: string;
  authorSlug: string;
  reviewerSlug: string | null;
  updatedOn: string;
  readMinutes: number;
};

export const categories: Category[] = [
  { slug: "buying", name: "Buying", blurb: "Process, contracts, due diligence" },
  { slug: "residency", name: "Residency", blurb: "Visas, permits, citizenship" },
  { slug: "money", name: "Money", blurb: "Banking, taxes, financing" },
  { slug: "living", name: "Living", blurb: "Cost of living, healthcare, schools" },
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

/* Generated from the live `articles` table (published rows) after the v1→v2
   content port — scripts/port-v1-articles.mjs, port-v1-areas.mjs,
   port-news-exception.mjs. `panama-closing-process` and `friendly-nations-visa`
   (previously hardcoded here) never had a matching Supabase row — they
   404'd at request time despite being statically generated — so they're
   dropped rather than carried forward as dead links. Re-run the generation
   query in scripts/port-v1-articles.mjs's companion export if content changes. */
export const articles: Article[] = [
  { slug: "apartments-for-rent-panama-city", categorySlug: "living", title: "Rent apartments in Panama City 2026: real prices, 7 neighborhoods", dek: "2BR in central Panama City: USD $1,300 to USD $2,000/mo, comparable to a studio in downtown Miami. The 7 neighborhoods expats actually rent in, by use case.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 14 },
  { slug: "apostille-documents-panama-visa", categorySlug: "residency", title: "Apostille for Panama residency 2026: 6 documents, 6 to 12 weeks, $400", dek: "FBI background check, birth and marriage certificates, plus 3 more. Apostille runs 6 to 12 weeks and USD $150 to USD $400 total. State-by-state filing playbook.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 14 },
  { slug: "atm-cash-panama-guide", categorySlug: "money", title: "ATMs and cash in Panama: what the banks actually publish", dek: "Panama's banks publish their ATM fees, and they run from nothing to B/.1.87 a withdrawal for a local customer. None of them publishes what a foreign card is charged. That number exists only on the machine's screen, and it is the one figure every guide to this quotes with confidence.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 10 },
  { slug: "avenida-balboa-panama-real-estate", categorySlug: "buying", title: "Avenida Balboa: how to tell which tower is actually the best buy", dek: "Avenida Balboa has Panama City's most coveted address — but not every tower on it is a smart buy. Before you fall for the view, look at the things that actually protect your money: the developer, the fees, the resale history, and how close you really are to the bay.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "June 2026", readMinutes: 7 },
  { slug: "best-beaches-panama-expats", categorySlug: "living", title: "Best Beaches in Panama 2026: Where Expats Relax, Weekend Guide", dek: "Best Beaches in Panama 2026: Where Expats Relax, Weekend Guide", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "best-neighborhoods-panama-city-expats", categorySlug: "buying", title: "Best Panama City neighborhoods for expats 2026: 7 zones ranked", dek: "Costa del Este for families. Punta Pacifica for hospital proximity. Casco Viejo for walkable urban. The 7 Panama City zones expats actually choose, and the trade in each.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "April 2026", readMinutes: 12 },
  { slug: "bocas-del-toro-real-estate", categorySlug: "buying", title: "Bocas del Toro, Panama real estate: titled land, ROP, and the cash-only reality", dek: "Waterfront land starts around $135,000. Whether you actually own it, or just have the right to occupy it, comes down to one word: titled, or Rights of Possession.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "July 2026", readMinutes: 9 },
  { slug: "boquete-panama-real-estate", categorySlug: "buying", title: "Boquete, Panama real estate: prices, title risk, and who it suits", dek: "A $75,000 lot and a $1.7 million lot both sell as \"Boquete real estate.\" The gap is what's built, how far up the mountain it sits, and whether it's actually titled.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "July 2026", readMinutes: 8 },
  { slug: "buying-property-in-panama", categorySlug: "buying", title: "Buying property in Panama: what it costs, what you own, and who files what", dek: "The transfer tax is 2% on cadastral value and the seller files it, not the 3.4% buyer cost most guides quote. Sourced to the DGI and the residency decree, including the $500,000 increase that is not actually in the law.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 11 },
  { slug: "colon-panama-real-estate", categorySlug: "buying", title: "Colón real estate: genuine opportunity or buyer's trap?", dek: "Panama's Caribbean side is overlooked, misunderstood, and changing fast. Between the Free Zone, the ports, and new investment, the honest answer to whether Colón is an opportunity depends on exactly where you buy — and why.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "June 2026", readMinutes: 7 },
  { slug: "condos-for-sale-panama-buyers-guide", categorySlug: "buying", title: "Condos for Sale Panama 2026: Buyers Guide, Prices, Investment", dek: "Condos for Sale Panama 2026: Buyers Guide, Prices, Investment", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "April 2026", readMinutes: 13 },
  { slug: "coronado-real-estate-guide", categorySlug: "buying", title: "Coronado Real Estate 2026: Prices, Beach Living, Investment Guide", dek: "Coronado Real Estate 2026: Prices, Beach Living, Investment Guide", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "April 2026", readMinutes: 18 },
  { slug: "friendly-nations-2026", categorySlug: "residency", title: "The Friendly Nations Visa in 2026, what changed, what stayed", dek: "The 2021 reform is settled law now. Here is the actual paperwork, timeline, and cost in 2026 dollars, with a checklist for each of the three qualifying routes.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "April 2026", readMinutes: 11 },
  { slug: "getting-around-panama-city-guide", categorySlug: "living", title: "Getting Around Panama City 2026: Metro, Uber, Bus & Taxi Guide", dek: "Getting Around Panama City 2026: Metro, Uber, Bus & Taxi Guide", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "how-to-rent-apartment-panama", categorySlug: "living", title: "How to Rent an Apartment in Panama 2026: Expat Guide, Costs, Tips", dek: "How to rent an apartment in Panama 2026: prices by neighborhood, contract terms, broker fees, and what landlords actually require from expat tenants.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 12 },
  { slug: "living-in-panama", categorySlug: "living", title: "Living in Panama: safety, healthcare and schools, by the official numbers", dek: "Panama recorded 593 homicides in 2025. Los Santos province, where Pedasí is, recorded one. Twenty victims nationwide were aged 60 or over. Where you live decides almost everything about daily life here, and the government publishes the data that proves it.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 14 },
  { slug: "internet-providers-panama-expats", categorySlug: "living", title: "Internet providers in Panama: two companies, and what ASEP actually counts", dek: "Cable Onda became Tigo in 2019. Claro became +Móvil in 2022. ASEP counted 783,609 fixed internet subscriptions in Panama for 2025, up from 645,053 in 2021. Two of the four providers most guides still list stopped existing years ago.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 10 },
  { slug: "moving-to-panama", categorySlug: "living", title: "Moving to Panama: landing your pets, your furniture and your licence", dek: "Panama's national quarantine for small animals was never repealed. One dog costs B/.65 in cash at Tocumen and can commit you to forty days on your own property. The household-goods allowance is B/.25,000 for any new resident and B/.10,000 for a pensionado, which is the wrong way round from how it is marketed.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 12 },
  { slug: "moving-to-panama-from-canada", categorySlug: "living", title: "Move from Canada to Panama 2026: Visa, Residency, Costs Guide", dek: "Move from Canada to Panama 2026: Visa, Residency, Costs Guide", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 16 },
  { slug: "moving-to-panama-from-texas", categorySlug: "living", title: "Move from Texas to Panama 2026: Visa, Costs, Guide", dek: "Move from Texas to Panama 2026: Visa, Costs, Guide", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 6 },
  { slug: "moving-to-panama-from-uk", categorySlug: "living", title: "Move from UK to Panama 2026: Visa, Costs, Relocation Guide", dek: "Move from UK to Panama 2026: Visa, Costs, Relocation Guide", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 6 },
  { slug: "moving-to-panama-with-pets", categorySlug: "living", title: "Moving to Panama with pets: the quarantine, and what it costs", dek: "Panama quarantines imported pets for forty days. It lets you serve it at your own address, which is why so many pages report it as no quarantine at all. A decree published in February 2026 re-priced the whole thing, and the guides ranking for this search have not caught up.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 11 },
  { slug: "panama-banking-non-residents-guide", categorySlug: "money", title: "Opening a Panama bank account as a non-resident: what the banks actually publish", dek: "Banco General's own account pages list a $50 or $300 minimum deposit, not the $500 to $10,000 range other guides quote. The real requirement is a document proving a \"link to Panama,\" which no bank spells out on its public site.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 8 },
  { slug: "panama-cost-of-living-2026", categorySlug: "money", title: "Panama cost of living: the official numbers, and why expat budgets look nothing like them", dek: "The 2023 census puts median rent in Provincia de Panamá at B/.300 a month. The MEF food basket feeds a 3.5-person household on B/.365.88. Both figures are official and current. Neither is what you will pay, and the gap is the most useful thing on this page.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 13 },
  { slug: "panama-drivers-license-foreigners", categorySlug: "living", title: "Get Driver License in Panama 2026: Foreigners Guide, Cost & Process", dek: "Get Driver License in Panama 2026: Foreigners Guide, Cost & Process How to get a Panama driver license. Requirements, cost, DMV process, written test. Drive legally in Panama.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-food-guide-expats", categorySlug: "living", title: "Panama Food Guide for Expats 2026: Cuisine, Markets, Restaurants", dek: "Panama food guide for expats 2026: tipico cuisine, markets, supermarkets, and top restaurants in Panama City, what to eat, where, and what it costs.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-for-digital-nomads-2026", categorySlug: "living", title: "Panama for Digital Nomads 2026: Visas, Internet, Cost of Living", dek: "Panama for Digital Nomads 2026: Visas, Internet, Cost of Living", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-golden-visa-2026", categorySlug: "residency", title: "Panama Golden Visa 2026: Investment Residency, Cost, Requirements", dek: "Panama Golden Visa 2026: Investment Residency, Cost, Requirements", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 14 },
  { slug: "panama-healthcare-costs-2026", categorySlug: "living", title: "Healthcare in Panama 2026: Costs, Doctors, Insurance, Quality", dek: "Healthcare in Panama 2026: Costs, Doctors, Insurance, Quality", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-property-buying-process-guide", categorySlug: "buying", title: "Buying property in Panama: the process, and what actually gets paid when", dek: "A 2% transfer tax that the seller owes, not the buyer. A property tax that is not zero. A capital gains rate that does not care about your residency. The step-by-step process, sourced to the DGI and Migración rather than to a blended closing-cost percentage.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 10 },
  { slug: "panama-property-tax-exemption-extended", categorySlug: "money", title: "National Assembly extends 20-year property tax exemption for new construction", dek: "The National Assembly extended the 20-year property tax exemption for new construction through 2028 — what it means for buyers.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "December 2025", readMinutes: 8 },
  { slug: "panama-real-estate-investment-lifestyle-2026", categorySlug: "buying", title: "Panama Real Estate 2026: Investment, Lifestyle & Retirement Guide", dek: "Panama City investment stock, beachfront at Coronado and Pedasi, and the Boquete mountain communities, compared on yield, appreciation and entry price. Covers pre-construction versus resale, and the LOI-to-closing sequence.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 15 },
  { slug: "panama-real-estate-market-2026", categorySlug: "buying", title: "Panama real estate market 2026: USD pricing by zone, Q1 movers", dek: "Coronado Phase III sold out. Costa del Este inventory up. Bocas pre-sale up YoY. The zones where USD pricing is moving in Panama right now, and why.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 20 },
  { slug: "panama-retirement-communities", categorySlug: "buying", title: "Retirement communities in Panama: title status, and the thresholds that actually apply", dek: "Every ranked list of Panama's retirement towns compares climate and rent estimates. The two things that genuinely differ between them are whether the land is titled and which residency threshold you meet. Both are checkable, and most published lists get the second one wrong.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 10 },
  { slug: "panama-sim-card-guide", categorySlug: "living", title: "SIM cards in Panama 2026: Claro, +Movil, Digicel (and eSIM)", dek: "Prepaid SIM from B/.3, eSIM from USD $4. Claro vs +Movil vs Digicel for tourists, expats, and long-term stays. Where to buy on day one with passport in hand.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-residency-guide", categorySlug: "residency", title: "Panama residency: the three routes, and which threshold actually applies", dek: "The cheapest property-based route is B/.200,000 under Friendly Nations, not the B/.300,000 marketed as Panama's golden visa. Two programmes, two thresholds, sourced to the Servicio Nacional de Migración requirement sheets.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 10 },
  { slug: "panama-tax-benefits-foreigners-2026", categorySlug: "residency", title: "Panama Tax Benefits for Foreigners 2026: Residency Tax Breaks", dek: "Panama Tax Benefits for Foreigners 2026: Residency Tax Breaks", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 15 },
  { slug: "panama-vs-belize-retirement", categorySlug: "living", title: "Panama vs Belize Retirement 2026: Which is Better? Comparison", dek: "Panama vs Belize Retirement 2026: Which is Better? Comparison", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-vs-colombia-retirement", categorySlug: "living", title: "Panama vs Colombia Retirement 2026: Comparison, Costs", dek: "Panama vs Colombia Retirement 2026: Comparison, Costs", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-vs-costa-rica-retirement", categorySlug: "living", title: "Panama vs Costa Rica Retirement 2026: Which is Better? Comparison", dek: "Panama vs Costa Rica Retirement 2026: Which is Better? Comparison", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-vs-mexico-retirement", categorySlug: "living", title: "Panama vs Mexico Retirement 2026: Which is Better? Full Comparison", dek: "Panama vs Mexico Retirement 2026: Which is Better? Full Comparison", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-vs-portugal-retirement", categorySlug: "living", title: "Panama vs Portugal Retirement 2026: Comparison, Costs, Visas", dek: "Panama vs Portugal Retirement 2026: Comparison, Costs, Visas", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-vs-spain-retirement", categorySlug: "living", title: "Panama vs Spain Retirement 2026: Comparison, Costs, Lifestyle", dek: "repurposed from the article Panama vs Spain Retirement 2026: Comparison, Costs, Lifestyle Compare Panama vs Spain for retirement. Golden Visa, costs, lifestyle, healthcare, communities.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "panama-weather-rainy-season-guide", categorySlug: "living", title: "Panama Weather & Rainy Season 2026: When to Go, What to Pack", dek: "Panama Weather & Rainy Season 2026: When to Go, What to Pack", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "pedasi-rising", categorySlug: "buying", title: "Pedasí is quietly becoming Panama's most-wanted coast", dek: "A fishing town of 3,000 now has two direct weekly flights and four resort-grade projects under construction. We visit, talk to developers, and map what comes next.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "April 2026", readMinutes: 13 },
  { slug: "real-cost-of-moving-to-panama", categorySlug: "money", title: "Real cost of moving to Panama 2026: visa, container, deposits", dek: "The Panama visa is USD $250. Container shipping from the US is USD $5k to USD $12k. First-and-deposit on a rental is 3 months. Total realistic relocation: USD $15k to USD $40k.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 12 },
  { slug: "retire-in-panama", categorySlug: "living", title: "Retire in Panama 2026: Complete Guide, Visas, Costs, Lifestyle", dek: "Retire in Panama 2026: Complete Guide, Visas, Costs, Lifestyle", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "safety-in-panama-2026-real-data-rumors", categorySlug: "living", title: "Is Panama safe? What the homicide statistics actually say", dek: "Panama recorded 300 homicide victims in the first half of 2026, up 8% on the same period last year. The Ministerio Público publishes that figure by province, by district and by month. It has never published a homicide rate for a neighbourhood, which is a problem for every page that quotes you one.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "August 2026", readMinutes: 11 },
  { slug: "santa-catalina-panama", categorySlug: "buying", title: "Santa Catalina Panama 2026: Surf Beach, Real Estate, Lifestyle", dek: "Santa Catalina Panama 2026: Surf Beach, Real Estate, Lifestyle Santa Catalina Panama. Surf town, real estate, costs, lifestyle, community, beach life.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "April 2026", readMinutes: 14 },
  { slug: "sending-money-panama-wire-transfer", categorySlug: "money", title: "Send money to Panama 2026: Wise, Remitly, wires (lowest fees)", dek: "Wise typically beats bank wires by 60 to 70 percent on USD to Panama transfers under USD $50k. Real fee comparison: Wise, Remitly, traditional banks, in-person FX.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 13 },
  { slug: "start-business-panama-foreigners", categorySlug: "residency", title: "Start Business in Panama 2026: Registration, Taxes, Visas", dek: "Register a Panama corporation in 2 to 4 weeks. 0% tax on foreign income. The 2026 playbook for foreigners launching a business, with real fees and timelines.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "March 2026", readMinutes: 19 },
  { slug: "things-to-do-in-panama", categorySlug: "living", title: "Things to Do in Panama 2026: Activities, Tourist Attractions", dek: "Things to Do in Panama 2026: Activities, Tourist Attractions", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
  { slug: "titled-vs-rights-of-possession", categorySlug: "buying", title: "Titled land vs. Rights of Possession in Panama", dek: "One distinction separates a clean purchase from an unsellable one. Here's how to check which you're being offered.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "July 2026", readMinutes: 9 },
  { slug: "why-expats-leave-panama-2-years", categorySlug: "living", title: "Why Most Expats Leave Panama After 2 Years: The Critical Mistakes", dek: "Why Most Expats Leave Panama After 2 Years: The Critical Mistakes Data shows a high 'churn' rate at the 24-month mark. Learn the top reasons why expat dreams fail and how to ensure you are the exception.", authorSlug: "editorial-team", reviewerSlug: null, updatedOn: "February 2026", readMinutes: 6 },
];

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

export const getArticle = (categorySlug: string, slug: string) =>
  articles.find((a) => a.categorySlug === categorySlug && a.slug === slug);

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
