import { cache } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeAmenities } from "@/lib/amenities";
import type { Area, Photo, Project, TitleStatus, UnitModel } from "@/lib/content";

/* =============================================================================
   The catalog — projects and areas, read from Supabase
   =============================================================================
   This replaces the `projects` and `areas` arrays that lib/content.ts used to
   derive from data/airtable.json at build time. The move is what lets a new
   development go live from the MCP the way an article already does: the JSON
   was a git-tracked file, so publishing a project meant a commit, a push and a
   rebuild.

   Nothing was lost in the move. The JSON and the database agreed on all 31
   projects and 18 areas with zero field mismatches, and only `photos` had to be
   added as a column (migration 0008). beds/size are derived from unit_models
   rather than stored, because that derivation matched the JSON exactly on every
   project and one fewer copy of a fact is one fewer way to disagree with
   yourself.

   `cache()` dedupes within a single render pass, which matters because
   listAreas() needs the projects to derive its counts and prices, and a page
   that renders both would otherwise fetch the same rows twice.
   ============================================================================= */

/* The database enum is under_construction; the UI has always used the hyphen,
   and statusLabel in lib/content.ts is keyed on it. Translate at the boundary
   rather than touching either side. */
const STATUS_FROM_DB = {
  preselling: "preselling",
  under_construction: "under-construction",
  delivered: "delivered",
} as const;

type ProjectRow = {
  slug: string;
  name: string;
  published: boolean;
  status: keyof typeof STATUS_FROM_DB | null;
  price_from_usd: number | null;
  price_to_usd: number | null;
  amenities: string[] | null;
  website_url: string | null;
  photos: Photo[] | null;
  source: string | null;
  areas: { slug: string } | { slug: string }[] | null;
  unit_models: {
    name: string | null;
    beds: number | null;
    baths: number | null;
    size_m2: number | null;
    price_from_usd: number | null;
    position: number | null;
  }[];
};

const PROJECT_COLUMNS = `
  slug, name, published, status, price_from_usd, price_to_usd,
  amenities, website_url, photos, source,
  areas ( slug ),
  unit_models ( name, beds, baths, size_m2, price_from_usd, position )
`;

const min = (ns: (number | null)[]) => {
  const v = ns.filter((n): n is number => typeof n === "number");
  return v.length ? Math.min(...v) : null;
};
const max = (ns: (number | null)[]) => {
  const v = ns.filter((n): n is number => typeof n === "number");
  return v.length ? Math.max(...v) : null;
};

function toProject(row: ProjectRow): Project {
  const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;

  const models: UnitModel[] = [...(row.unit_models ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((m) => ({
      name: m.name,
      beds: m.beds,
      baths: m.baths,
      sizeM2: m.size_m2,
      priceFromUsd: m.price_from_usd,
    }));

  return {
    slug: row.slug,
    name: row.name,
    areaSlug: area?.slug ?? "",
    published: row.published,
    status: row.status ? STATUS_FROM_DB[row.status] : null,
    priceFromUsd: row.price_from_usd,
    priceToUsd: row.price_to_usd,
    // Derived, never stored. See the header note.
    bedsMin: min(models.map((m) => m.beds)),
    bedsMax: max(models.map((m) => m.beds)),
    sizeFromM2: min(models.map((m) => m.sizeM2)),
    // v1's Airtable prose was SEO spam and is deliberately not carried.
    descriptionEn: null,
    // Raw Spanish developer copy, cleaned here. See lib/amenities.
    amenities: normalizeAmenities(row.amenities ?? []),
    websiteUrl: row.website_url,
    rawLocation: null,
    models,
    photos: row.photos ?? [],
    dataSource: row.source ?? "developer_listed",
  };
}

/** Every project, including unpublished. Internal tooling only — never render
 *  these. `published` is the editorial control and listings must honour it. */
export const listAllProjects = cache(async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("name");
  if (error || !data) return [];
  return (data as unknown as ProjectRow[]).map(toProject);
});

export const listProjects = cache(async (): Promise<Project[]> =>
  (await listAllProjects()).filter((p) => p.published),
);

export const getProject = cache(async (slug: string): Promise<Project | null> =>
  (await listAllProjects()).find((p) => p.slug === slug) ?? null,
);

export const getProjectsForArea = cache(async (slug: string): Promise<Project[]> =>
  (await listProjects()).filter((p) => p.areaSlug === slug),
);

type AreaRow = {
  slug: string;
  name: string;
  region: string;
  positioning: string | null;
  elevation_m: number | null;
  climate: string | null;
  title_status: TitleStatus;
  title_note: string | null;
  title_verified_on: string | null;
};

export const listAreas = cache(async (): Promise<Area[]> => {
  const [{ data, error }, published] = await Promise.all([
    supabase
      .from("areas")
      .select(
        "slug, name, region, positioning, elevation_m, climate, title_status, title_note, title_verified_on",
      )
      .order("name"),
    listProjects(),
  ]);
  if (error || !data) return [];

  return (data as AreaRow[]).map((a) => {
    const inArea = published.filter((p) => p.areaSlug === a.slug);

    /* Derived from published inventory, not from a stored total. Quoting a
       price from a project a visitor cannot open is worse than quoting none. */
    const froms = inArea.map((p) => p.priceFromUsd);
    const tops = inArea.map((p) => p.priceToUsd ?? p.priceFromUsd);

    return {
      slug: a.slug,
      name: a.name,
      region: a.region,
      titleStatus: a.title_status,
      titleNote: a.title_note,
      positioning: a.positioning,
      elevationM: a.elevation_m,
      climate: a.climate,
      verifiedOn: a.title_verified_on,
      projectCount: inArea.length,
      priceFromUsd: min(froms),
      priceToUsd: max(tops),
      // Borrow the first project photo until we have area photography.
      photo: inArea.find((p) => p.photos.length)?.photos[0]?.src ?? null,
    };
  });
});

export const getArea = cache(async (slug: string): Promise<Area | null> =>
  (await listAreas()).find((a) => a.slug === slug) ?? null,
);
