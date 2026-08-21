import Link from "next/link";
import type { Area } from "@/lib/content";
import type { Project } from "@/lib/content";
import type { AreaEditorialFull } from "@/lib/editorial";
import { usd } from "@/lib/content";
import { localePath, type PageLocale } from "@/lib/i18n";
import { Button, TitleBadge, SourceNote, Prose } from "@/components/ui";
import { ProjectCard } from "@/components/project-card";

/* =============================================================================
   The area detail body, shared by both language trees
   =============================================================================
   Extracted rather than duplicated, for the reason `article-markdown.tsx` was
   (commit 5e0a500): two copies of 300 lines of markup drift, and the half that
   drifts is always the one fewer people read. The English route and
   /de/regionen/[slug] now render the same component and differ only in what
   they pass it.

   Page-level copy lives here rather than in lib/i18n.ts because it is specific
   to this one page. `ui()` is for chrome that appears on every page; twenty
   strings that exist only on an area page would bury it.

   The German copy is not a translation of the English line by line. Two places
   deliberately diverge:

     - The title-guide link keeps pointing at the ENGLISH guide and says so, in
       the "(auf Englisch)" form the published German pages already use. A link
       that silently lands a German reader on English is worse than one that
       warns them; a link suppressed entirely is worse than both, because the
       title distinction is the single most expensive thing to get wrong here.

     - Nothing reaches for Grundbuch vocabulary. `immobilienmarkt-panama`
       argues that the Registro Público is not a Grundbuch, and this component
       renders next to that argument.
   ============================================================================= */

type Copy = {
  home: string;
  areas: string;
  specEntry: string;
  specUpper: string;
  specProjects: string;
  specElevation: string;
  specClimate: string;
  pricesAsListed: string;
  titleHeading: string;
  titleFallback: (name: string) => string;
  titleGuideHref: string;
  titleGuideLabel: string;
  costHeading: (name: string) => string;
  suitsHeading: (name: string) => string;
  gettingAroundHeading: string;
  projectsHeading: (name: string) => string;
  projectsCount: (n: number) => string;
  projectsEmpty: string;
  projectsNote: (checked: boolean) => string;
  faqHeading: string;
  sourcesHeading: string;
  checkedOn: (d: string) => string;
  ctaHeading: (name: string) => string;
  ctaBody: string;
  ctaButton: string;
  ctaHref: string;
  nearby: (region: string) => string;
};

const COPY: Record<PageLocale, Copy> = {
  en: {
    home: "Home",
    areas: "Areas",
    specEntry: "Entry price",
    specUpper: "Upper range",
    specProjects: "Projects",
    specElevation: "Elevation",
    specClimate: "Climate",
    pricesAsListed: "Prices as listed by developers",
    titleHeading: "Before you shortlist anything here",
    titleFallback: (name) =>
      `We have not yet checked whether land in ${name} is titled or held as Rights of Possession. Until we have, treat every listing here as unverified and ask the seller for a finca number before you pay anything.`,
    titleGuideHref: "/buying/titled-vs-rights-of-possession",
    titleGuideLabel: "How to check which one you’re being offered →",
    costHeading: (name) => `What it costs to live in ${name}`,
    suitsHeading: (name) => `Who ${name} suits — and who it doesn’t`,
    gettingAroundHeading: "Getting there and getting around",
    projectsHeading: (name) => `Projects in ${name}`,
    projectsCount: (n) => `${n} listed`,
    projectsEmpty:
      "Nothing published here yet. Tell us what you’re looking for and we’ll send what’s available off-listing.",
    projectsNote: (checked) =>
      `Prices as listed by developers · ${checked ? "see title status above" : "title status not yet checked"}`,
    faqHeading: "FAQ",
    sourcesHeading: "Sources",
    checkedOn: (d) => ` — checked ${d}`,
    ctaHeading: (name) => `Want the ${name} shortlist with title status attached?`,
    ctaBody: "A broker will follow up. You’ll get the paperwork status first.",
    ctaButton: "Get the shortlist",
    ctaHref: "/contact",
    nearby: (region) => `Also in ${region}`,
  },
  de: {
    home: "Start",
    areas: "Regionen",
    specEntry: "Ab Preis",
    specUpper: "Bis",
    specProjects: "Projekte",
    specElevation: "Höhe",
    specClimate: "Klima",
    pricesAsListed: "Preise laut Angaben der Bauträger",
    titleHeading: "Bevor Sie hier etwas in die engere Wahl nehmen",
    titleFallback: (name) =>
      `Wir haben noch nicht geprüft, ob Grundstücke in ${name} tituliert sind oder als *derecho de posesión*, also besitzrechtlich, gehalten werden. Bis dahin gilt jedes Angebot hier als ungeprüft: Lassen Sie sich die *finca*-Nummer geben und im Registro Público prüfen, bevor Sie zahlen.`,
    titleGuideHref: "/buying/titled-vs-rights-of-possession",
    titleGuideLabel:
      "So erkennen Sie, was Ihnen angeboten wird (auf Englisch) →",
    costHeading: (name) => `Was das Leben in ${name} kostet`,
    suitsHeading: (name) => `Für wen ${name} passt, und für wen nicht`,
    gettingAroundHeading: "Anreise und Mobilität vor Ort",
    projectsHeading: (name) => `Projekte in ${name}`,
    projectsCount: (n) => `${n} gelistet`,
    projectsEmpty:
      "Hier ist noch nichts veröffentlicht. Schreiben Sie uns, wonach Sie suchen, und Sie bekommen, was außerhalb der Listen verfügbar ist.",
    projectsNote: (checked) =>
      `Preise laut Angaben der Bauträger · ${checked ? "Titelstatus siehe oben" : "Titelstatus noch nicht geprüft"}`,
    faqHeading: "Häufige Fragen",
    sourcesHeading: "Quellen",
    checkedOn: (d) => ` — geprüft am ${d}`,
    ctaHeading: (name) => `Möchten Sie die Auswahl für ${name} mit Titelstatus?`,
    ctaBody:
      "Ein Makler meldet sich. Den Stand der Unterlagen bekommen Sie zuerst. Der Makler antwortet auf Englisch.",
    ctaButton: "Auswahl anfordern",
    ctaHref: "/contact",
    nearby: (region) => `Ebenfalls in ${region}`,
  },
};

export function AreaDetail({
  area,
  editorial,
  areaProjects,
  areas,
  locale = "en",
}: {
  area: Area;
  editorial: AreaEditorialFull | null;
  areaProjects: Project[];
  areas: Area[];
  locale?: PageLocale;
}) {
  const c = COPY[locale];
  const path = (p: string) => localePath(locale, p);

  const positioning = editorial?.positioning ?? area.positioning;
  const titleStatus = editorial?.titleStatus ?? area.titleStatus;
  const titleNote = editorial?.titleNote ?? area.titleNote;

  const specs = [
    { k: c.specEntry, v: usd(area.priceFromUsd) },
    { k: c.specUpper, v: usd(area.priceToUsd) },
    { k: c.specProjects, v: String(area.projectCount) },
    area.elevationM != null
      ? { k: c.specElevation, v: `${area.elevationM}m` }
      : null,
    area.climate ? { k: c.specClimate, v: area.climate } : null,
  ].filter((s): s is { k: string; v: string } => s !== null);

  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,68px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href={path("/")} className="text-white/70 underline">
              {c.home}
            </Link>
            <span className="mx-2">/</span>
            <Link href={path("/areas")} className="text-white/70 underline">
              {c.areas}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{area.name}</span>
          </nav>

          <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            {area.region}
          </p>
          <h1 className="h1-article !text-white max-w-[18ch]">{area.name}</h1>
          {positioning && (
            <p className="dek !text-white/90 mt-5 max-w-[62ch]">{positioning}</p>
          )}

          <hr className="border-0 h-px bg-accent/45 my-7" />

          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            {specs.map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/55">
                  {s.k}
                </dt>
                <dd className="font-display text-[21px] font-bold text-white tnum mt-1">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <SourceNote>{c.pricesAsListed}</SourceNote>
          </div>
        </div>
      </section>

      {/* ── Title risk — the first thing, every time ─────────────────────── */}
      <section className="py-[clamp(40px,5vw,64px)]">
        <div className="wrap">
          <div
            className={`rounded-md border-l-4 p-6 max-w-[76ch] ${
              titleStatus === "rop"
                ? "bg-negative-50 border-negative"
                : titleStatus === "mixed"
                  ? "bg-accent-50 border-star"
                  : titleStatus === "titled"
                    ? "bg-positive-50 border-positive"
                    : "bg-paper-warm border-line"
            }`}
          >
            <p className="font-display text-[14px] font-bold uppercase tracking-[0.077em] text-ink">
              {c.titleHeading}
            </p>
            <div className="mt-3">
              <TitleBadge status={titleStatus} locale={locale} />
            </div>
            <Prose className="mt-3.5 max-w-[62ch]">
              {titleNote ?? c.titleFallback(area.name)}
            </Prose>
            <Link
              href={c.titleGuideHref}
              className="inline-block mt-4 font-semibold text-link no-underline hover:underline"
            >
              {c.titleGuideLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* ── What it costs to live here ────────────────────────────────────── */}
      {editorial?.costOfLivingNote && (
        <section className="py-[clamp(32px,4vw,52px)] border-t border-line">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">{c.costHeading(area.name)}</h2>
            <Prose className="mt-5 max-w-[70ch]">{editorial.costOfLivingNote}</Prose>
          </div>
        </section>
      )}

      {/* ── Who it suits, and who it doesn't ────────────────────────────── */}
      {(editorial?.suits || editorial?.drawbacks) && (
        <section className="py-[clamp(32px,4vw,52px)] border-t border-line">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">{c.suitsHeading(area.name)}</h2>
            {editorial.suits && (
              <Prose className="mt-5 max-w-[70ch]">{editorial.suits}</Prose>
            )}
            {editorial.drawbacks && (
              <Prose className="mt-4 max-w-[70ch]">{editorial.drawbacks}</Prose>
            )}
          </div>
        </section>
      )}

      {/* ── Getting there and getting around ────────────────────────────── */}
      {editorial?.gettingAroundNote && (
        <section className="py-[clamp(32px,4vw,52px)] border-t border-line">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">{c.gettingAroundHeading}</h2>
            <Prose className="mt-5 max-w-[70ch]">
              {editorial.gettingAroundNote}
            </Prose>
          </div>
        </section>
      )}

      {/* ── Projects ─────────────────────────────────────────────────────── */}
      <section className="bg-paper-warm border-y border-line py-[clamp(52px,7vw,80px)]">
        <div className="wrap">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="h2-section max-w-[24ch]">
              {c.projectsHeading(area.name)}
            </h2>
            <p className="font-mono text-[13px] text-muted tnum">
              {c.projectsCount(areaProjects.length)}
            </p>
          </div>

          {areaProjects.length === 0 ? (
            <p className="mt-6 text-muted max-w-[60ch]">{c.projectsEmpty}</p>
          ) : (
            <div className="mt-9 grid gap-6 min-[720px]:grid-cols-2 min-[1080px]:grid-cols-3">
              {areaProjects.map((p) => (
                <ProjectCard key={p.slug} project={p} area={area} locale={locale} />
              ))}
            </div>
          )}

          <div className="mt-5">
            <SourceNote>{c.projectsNote(titleStatus !== "unknown")}</SourceNote>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {editorial && editorial.faqs.length > 0 && (
        <section className="py-[clamp(48px,6vw,72px)]">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">{c.faqHeading}</h2>
            <div className="mt-8 flex flex-col gap-3 max-w-[70ch]">
              {editorial.faqs.map((f, i) => (
                <div key={i} className="rounded-md border border-line p-5">
                  <p className="font-display text-[15.5px] font-bold text-ink">
                    {f.q}
                  </p>
                  <Prose className="mt-2 [&_p]:text-[15px] [&_li]:text-[15px]">
                    {f.a}
                  </Prose>
                </div>
              ))}
            </div>
            {editorial.sources.length > 0 && (
              <div className="max-w-[70ch] mt-10 border-t border-line pt-6">
                <p className="font-display text-[14px] font-bold uppercase tracking-[0.077em] text-ink">
                  {c.sourcesHeading}
                </p>
                <ol className="mt-3 text-[15px] space-y-1">
                  {editorial.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        rel="nofollow noopener"
                        target="_blank"
                        className="text-link no-underline hover:underline"
                      >
                        {s.label}
                      </a>
                      {s.checkedOn && (
                        <span className="text-faint">{c.checkedOn(s.checkedOn)}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Lead capture ────────────────────────────────────────────────── */}
      <section className="py-[clamp(52px,7vw,80px)]">
        <div className="wrap">
          <div className="hero-band rounded-lg p-[clamp(26px,4vw,44px)] flex flex-wrap items-center justify-between gap-7">
            <div>
              <h2 className="font-display text-[clamp(22px,2.8vw,30px)] font-bold tracking-[-0.019em] text-white max-w-[24ch] leading-tight">
                {c.ctaHeading(area.name)}
              </h2>
              <p className="mt-3 text-white/85 max-w-[54ch]">{c.ctaBody}</p>
            </div>
            <Button href={path(c.ctaHref)}>{c.ctaButton}</Button>
          </div>
        </div>
      </section>

      {/* ── Nearby ──────────────────────────────────────────────────────── */}
      <section className="border-t border-line py-[clamp(40px,5vw,64px)]">
        <div className="wrap">
          <p className="eyebrow mb-4">{c.nearby(area.region)}</p>
          <div className="flex flex-wrap gap-2.5">
            {areas
              .filter((a) => a.region === area.region && a.slug !== area.slug)
              .map((a) => (
                <Link
                  key={a.slug}
                  href={path(`/areas/${a.slug}`)}
                  className="rounded-full border border-line px-4 py-1.5 font-display text-[13.5px] font-semibold text-body no-underline hover:border-brand hover:text-brand transition-colors"
                >
                  {a.name}{" "}
                  <span className="text-faint tnum">({a.projectCount})</span>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
