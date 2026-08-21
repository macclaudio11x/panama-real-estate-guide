"use client";

import { useMemo, useState } from "react";
import type { Area, Project } from "@/lib/content";
import { ProjectCard } from "@/components/project-card";
import type { PageLocale } from "@/lib/i18n";
import { SourceNote } from "@/components/ui";

/* =============================================================================
   Project search — the portal pattern (realtor.com / Zillow / Redfin)
   =============================================================================
   Filter row above, result count + sort, then a card grid. The conventions are
   deliberate: buyers already know how to read this layout, and fighting that
   costs conversions for no gain.

   Two departures, both because these are developments rather than resale homes:
   · A project has many unit types, so the card shows a price FROM and a unit
     count instead of one price and one bed/bath figure.
   · Delivery quarter replaces days-on-market.

   Not built yet: the map pane. Airtable carries no coordinates, and placing
   pins at area centroids would imply a precision we do not have.
   ============================================================================= */

type SortKey = "price-asc" | "price-desc" | "units-desc" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "price-asc", label: "Price (low to high)" },
  { key: "price-desc", label: "Price (high to low)" },
  { key: "units-desc", label: "Most unit types" },
  { key: "name", label: "Name (A–Z)" },
];

const PRICE_BANDS = [
  { key: "any", label: "Any price", min: 0, max: Infinity },
  { key: "u200", label: "Under $200k", min: 0, max: 200_000 },
  { key: "200-400", label: "$200k – $400k", min: 200_000, max: 400_000 },
  { key: "400-700", label: "$400k – $700k", min: 400_000, max: 700_000 },
  { key: "700plus", label: "$700k+", min: 700_000, max: Infinity },
];

const control =
  "rounded-sm border border-line bg-white px-3 py-2 text-[14.5px] text-body focus:border-brand outline-none cursor-pointer";


/* Copy for both trees. Kept here rather than in lib/i18n.ts for the same reason
   as <AreaDetail>: these strings appear on exactly one screen, and ui() is for
   chrome that appears on every page. */
type SearchCopy = {
  sorts: Record<SortKey, string>;
  bands: Record<string, string>;
  regionLabel: string;
  areaLabel: string;
  priceLabel: string;
  statusLabel: string;
  sortLabel: string;
  allRegions: string;
  allAreas: string;
  anyStatus: string;
  statusPreselling: string;
  statusUnderConstruction: string;
  statusDelivered: string;
  count: (n: number) => string;
  inArea: (name: string) => string;
  acrossPanama: string;
  sourceNote: string;
  emptyTitle: string;
  emptyBody: (total: number) => string;
  clearFilters: string;
};

const SEARCH_COPY: Record<PageLocale, SearchCopy> = {
  en: {
    sorts: {
      "price-asc": "Price (low to high)",
      "price-desc": "Price (high to low)",
      "units-desc": "Most unit types",
      name: "Name (A\u2013Z)",
    },
    bands: {
      any: "Any price",
      u200: "Under $200k",
      "200-400": "$200k \u2013 $400k",
      "400-700": "$400k \u2013 $700k",
      "700plus": "$700k+",
    },
    regionLabel: "Region",
    areaLabel: "Area",
    priceLabel: "Price",
    statusLabel: "Build status",
    sortLabel: "Sort by",
    allRegions: "All regions",
    allAreas: "All areas",
    anyStatus: "Any status",
    statusPreselling: "Preselling",
    statusUnderConstruction: "Under construction",
    statusDelivered: "Delivered",
    count: (n) => `${n} project${n === 1 ? "" : "s"}`,
    inArea: (name) => `in ${name}`,
    acrossPanama: "across Panama",
    sourceNote:
      "Prices as listed by developers \u00b7 title status not yet checked on any listing",
    emptyTitle: "Nothing matches those filters",
    emptyBody: (total) =>
      `We track ${total} projects in total. Widen the price band or clear the area filter.`,
    clearFilters: "Clear all filters",
  },
  de: {
    sorts: {
      "price-asc": "Preis (aufsteigend)",
      "price-desc": "Preis (absteigend)",
      "units-desc": "Meiste Wohnungstypen",
      name: "Name (A\u2013Z)",
    },
    bands: {
      any: "Beliebiger Preis",
      u200: "Unter 200.000 $",
      "200-400": "200.000 \u2013 400.000 $",
      "400-700": "400.000 \u2013 700.000 $",
      "700plus": "\u00dcber 700.000 $",
    },
    regionLabel: "Gebiet",
    areaLabel: "Region",
    priceLabel: "Preis",
    statusLabel: "Baustatus",
    sortLabel: "Sortieren nach",
    allRegions: "Alle Gebiete",
    allAreas: "Alle Regionen",
    anyStatus: "Beliebiger Status",
    statusPreselling: "Im Vorverkauf",
    statusUnderConstruction: "Im Bau",
    statusDelivered: "Fertiggestellt",
    count: (n) => `${n} Projekt${n === 1 ? "" : "e"}`,
    inArea: (name) => `in ${name}`,
    acrossPanama: "in ganz Panama",
    sourceNote:
      "Preise laut Angaben der Bautr\u00e4ger \u00b7 Titelstatus bei keinem Angebot gepr\u00fcft",
    emptyTitle: "Zu diesen Filtern gibt es nichts",
    emptyBody: (total) =>
      `Wir f\u00fchren insgesamt ${total} Projekte. Erweitern Sie die Preisspanne oder setzen Sie den Regionsfilter zur\u00fcck.`,
    clearFilters: "Alle Filter zur\u00fccksetzen",
  },
};

export function ProjectSearch({
  projects,
  areas,
  locale = "en",
}: {
  projects: Project[];
  areas: Area[];
  locale?: PageLocale;
}) {
  const c = SEARCH_COPY[locale];
  const [area, setArea] = useState("all");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("any");
  const [sort, setSort] = useState<SortKey>("price-asc");

  const regions = useMemo(
    () => [...new Set(areas.map((a) => a.region))].sort(),
    [areas],
  );

  const visibleAreas = useMemo(
    () => (region === "all" ? areas : areas.filter((a) => a.region === region)),
    [areas, region],
  );

  const results = useMemo(() => {
    const price = PRICE_BANDS.find((b) => b.key === band)!;

    const filtered = projects.filter((p) => {
      if (area !== "all" && p.areaSlug !== area) return false;
      if (region !== "all") {
        const a = areas.find((x) => x.slug === p.areaSlug);
        if (a?.region !== region) return false;
      }
      if (status !== "all" && p.status !== status) return false;
      const from = p.priceFromUsd ?? 0;
      if (from < price.min || from > price.max) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sort === "price-asc")
      sorted.sort((a, b) => (a.priceFromUsd ?? 0) - (b.priceFromUsd ?? 0));
    if (sort === "price-desc")
      sorted.sort((a, b) => (b.priceFromUsd ?? 0) - (a.priceFromUsd ?? 0));
    if (sort === "units-desc")
      sorted.sort((a, b) => b.models.length - a.models.length);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [projects, areas, area, region, status, band, sort]);

  const reset = () => {
    setArea("all");
    setRegion("all");
    setStatus("all");
    setBand("any");
  };

  const filtered =
    area !== "all" || region !== "all" || status !== "all" || band !== "any";

  return (
    <>
      {/* ── Filter row — one row above the results, portal convention ────── */}
      <div className="sticky top-[70px] z-40 bg-white/95 backdrop-blur-[10px] border-b border-line">
        <div className="wrap py-3.5 flex flex-wrap items-center gap-2.5">
          <select
            aria-label={c.regionLabel}
            className={control}
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setArea("all");
            }}
          >
            <option value="all">{c.allRegions}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            aria-label={c.areaLabel}
            className={control}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="all">{c.allAreas}</option>
            {visibleAreas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            aria-label={c.priceLabel}
            className={control}
            value={band}
            onChange={(e) => setBand(e.target.value)}
          >
            {PRICE_BANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {c.bands[b.key]}
              </option>
            ))}
          </select>

          <select
            aria-label={c.statusLabel}
            className={control}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">{c.anyStatus}</option>
            <option value="preselling">{c.statusPreselling}</option>
            <option value="under-construction">{c.statusUnderConstruction}</option>
            <option value="delivered">{c.statusDelivered}</option>
          </select>

          {filtered && (
            <button
              onClick={reset}
              className="font-display text-[14px] font-semibold text-brand underline underline-offset-2 cursor-pointer px-2"
            >
              Clear
            </button>
          )}

          <select
            aria-label={c.sortLabel}
            className={`${control} ml-auto`}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {c.sorts[s.key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div className="wrap py-[clamp(28px,4vw,44px)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p
            aria-live="polite"
            className="font-display text-[17px] font-bold text-ink"
          >
            {c.count(results.length)}
            <span className="font-body font-normal text-muted">
              {" "}
              {area !== "all"
                ? c.inArea(areas.find((a) => a.slug === area)?.name ?? "")
                : region !== "all"
                  ? c.inArea(region)
                  : c.acrossPanama}
            </span>
          </p>

          {/* Said once for the whole grid. Repeating it on every card made 13
              identical badges that distinguished nothing. */}
          <SourceNote>{c.sourceNote}</SourceNote>
        </div>

        {results.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-line bg-paper-warm p-8 max-w-[60ch]">
            <p className="font-display text-[19px] font-bold text-ink">
              {c.emptyTitle}
            </p>
            <p className="mt-2.5 text-muted">
              {c.emptyBody(projects.length)}
            </p>
            <button
              onClick={reset}
              className="mt-4 font-display font-semibold text-brand underline underline-offset-2 cursor-pointer"
            >
              {c.clearFilters}
            </button>
          </div>
        ) : (
          <div className="mt-7 grid gap-6 min-[680px]:grid-cols-2 min-[1080px]:grid-cols-3">
            {results.map((p) => (
              <ProjectCard
                key={p.slug}
                project={p}
                area={areas.find((x) => x.slug === p.areaSlug)}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
