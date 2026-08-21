import Link from "next/link";
import Image from "next/image";
import type { Area, Project } from "@/lib/content";
import type { ProjectEditorial } from "@/lib/editorial";
import { usd, m2 } from "@/lib/content";
import {
  lead as leadStrings,
  localePath,
  statusLabelFor,
  type PageLocale,
} from "@/lib/i18n";
import { TitleBadge, SourceNote, Prose } from "@/components/ui";
import { LeadAttribution, LeadFormError } from "@/components/lead-attribution";
import { Turnstile } from "@/components/turnstile";
import { mediaUrl } from "@/lib/media";

/* =============================================================================
   The project detail body, shared by both language trees
   =============================================================================
   Extracted for the same reason <AreaDetail> was: 400 lines of markup copied
   into a second tree drift apart, and this page carries a live lead form, so
   the copy that drifts would be the one taking people's details.

   The lead card reuses `leadStrings(locale)` rather than inventing its own
   German. That block already went through §9a review, and it carries Decision
   6: the German form states that the broker replies in English, ABOVE the
   privacy note, not in small print. A project enquiry is the warmest lead on
   the site, so that is the worst place to let someone find out afterwards.

   ⚠️ The English content gap carries over. Airtable's `Descripción EN` is v1
   SEO spam and is deliberately not rendered, so a project page is thin until a
   human writes the hook, the location note and the buying note. Translating a
   thin page produces a thin German page. See P3 in the 1:1 plan, which is why
   projects go last.
   ============================================================================= */

type Copy = {
  home: string;
  projects: string;
  photosFromDeveloper: (n: number) => string;
  priceFrom: string;
  priceTo: string;
  noVerifiedPrice: string;
  factUnitTypes: string;
  factSmallest: string;
  factBedrooms: string;
  factStatus: string;
  factArea: string;
  pricesHeading: (name: string) => string;
  tableHeads: readonly string[];
  pricedNote: (priced: number, total: number, checkedOn: string | null) => string;
  locationHeading: (name: string) => string;
  includedHeading: (name: string) => string;
  suitsHeading: (name: string) => string;
  beforeHeading: (name: string) => string;
  beforeFallback: string;
  titleGuideHref: string;
  titleGuideLabel: string;
  faqHeading: string;
  askHeading: (name: string) => string;
  askBody: string;
  submit: string;
  developerSite: string;
  developerSiteLink: string;
  siblingsHeading: (areaName: string) => string;
};

const COPY: Record<PageLocale, Copy> = {
  en: {
    home: "Home",
    projects: "Projects",
    photosFromDeveloper: (n) => `${n} photos from the developer`,
    priceFrom: "from",
    priceTo: "to",
    noVerifiedPrice: "No independently verified pricing",
    factUnitTypes: "Unit types",
    factSmallest: "Smallest unit",
    factBedrooms: "Bedrooms",
    factStatus: "Status",
    factArea: "Area",
    pricesHeading: (name) => `${name} prices and floor plans`,
    tableHeads: ["Unit", "Beds", "Baths", "Size", "From"],
    pricedNote: (priced, total, checkedOn) =>
      `${priced} of ${total} unit types priced · as listed by the developer${checkedOn ? ` · checked ${checkedOn}` : ""}`,
    locationHeading: (name) => `Where ${name} actually is`,
    includedHeading: (name) => `What’s included at ${name}`,
    suitsHeading: (name) => `Who ${name} suits — and who it doesn’t`,
    beforeHeading: (name) => `Before you buy at ${name}`,
    beforeFallback:
      "We have not independently checked the title status, permits, or delivery record for this project. Everything on this page comes from the developer. Ask for the finca number and have an attorney pull the Registro Público entry before you pay a deposit of any size.",
    titleGuideHref: "/buying/titled-vs-rights-of-possession",
    titleGuideLabel: "What to check, and how →",
    faqHeading: "FAQ",
    askHeading: (name) => `Ask about ${name}`,
    askBody:
      "A licensed broker will follow up with availability, floor plans, and what the paperwork actually looks like.",
    submit: "Request details",
    developerSite: "Developer’s own site:",
    developerSiteLink: "view listing",
    siblingsHeading: (areaName) => `Other projects in ${areaName}`,
  },
  de: {
    home: "Start",
    projects: "Projekte",
    photosFromDeveloper: (n) => `${n} Fotos vom Bauträger`,
    priceFrom: "ab",
    priceTo: "bis",
    noVerifiedPrice: "Kein unabhängig geprüfter Preis",
    factUnitTypes: "Wohnungstypen",
    factSmallest: "Kleinste Einheit",
    factBedrooms: "Schlafzimmer",
    factStatus: "Status",
    factArea: "Region",
    pricesHeading: (name) => `${name}: Preise und Grundrisse`,
    tableHeads: ["Typ", "Schlafz.", "Bäder", "Fläche", "Ab"],
    pricedNote: (priced, total, checkedOn) =>
      `${priced} von ${total} Wohnungstypen mit Preis · laut Angaben des Bauträgers${checkedOn ? ` · geprüft am ${checkedOn}` : ""}`,
    locationHeading: (name) => `Wo ${name} tatsächlich liegt`,
    includedHeading: (name) => `Was bei ${name} enthalten ist`,
    suitsHeading: (name) => `Für wen ${name} passt, und für wen nicht`,
    beforeHeading: (name) => `Bevor Sie bei ${name} kaufen`,
    beforeFallback:
      "Wir haben Titelstatus, Genehmigungen und die Liefertreue dieses Projekts nicht unabhängig geprüft. Alle Angaben auf dieser Seite stammen vom Bauträger. Lassen Sie sich die *finca*-Nummer geben und den Eintrag im Registro Público von einem Anwalt prüfen, bevor Sie eine Anzahlung leisten, gleich in welcher Höhe.",
    /* Points at the English guide and says so, the same convention the
       published German pages use for a guide that has no German version yet. */
    titleGuideHref: "/buying/titled-vs-rights-of-possession",
    titleGuideLabel: "Was Sie prüfen sollten, und wie (auf Englisch) →",
    faqHeading: "Häufige Fragen",
    askHeading: (name) => `Fragen zu ${name}`,
    askBody:
      "Ein zugelassener Makler meldet sich mit Verfügbarkeit, Grundrissen und dem tatsächlichen Stand der Unterlagen.",
    submit: "Unterlagen anfordern",
    developerSite: "Website des Bauträgers:",
    developerSiteLink: "zum Angebot",
    siblingsHeading: (areaName) => `Weitere Projekte in ${areaName}`,
  },
};

export function ProjectDetail({
  project: p,
  editorial,
  area,
  siblings,
  locale = "en",
}: {
  project: Project;
  editorial: ProjectEditorial | null;
  area: Area | null;
  siblings: Project[];
  locale?: PageLocale;
}) {
  const c = COPY[locale];
  const t = locale === "en" ? null : leadStrings(locale);
  const path = (x: string) => localePath(locale, x);

  const prices = p.models
    .map((m) => m.priceFromUsd)
    .filter((n): n is number => typeof n === "number");

  const facts = [
    p.models.length ? { k: c.factUnitTypes, v: String(p.models.length) } : null,
    p.sizeFromM2 != null ? { k: c.factSmallest, v: m2(p.sizeFromM2) } : null,
    p.bedsMin != null
      ? {
          k: c.factBedrooms,
          v: p.bedsMin === p.bedsMax ? `${p.bedsMin}` : `${p.bedsMin}–${p.bedsMax}`,
        }
      : null,
    p.status ? { k: c.factStatus, v: statusLabelFor(locale, p.status) ?? p.status } : null,
    area ? { k: c.factArea, v: area.name } : null,
  ].filter((f): f is { k: string; v: string } => f !== null);

  return (
    <>
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <div className="border-b border-line bg-paper-warm">
        <nav className="wrap py-3.5 font-mono text-[11.5px] uppercase tracking-[0.077em] text-muted">
          <Link href={path("/")} className="text-muted no-underline hover:text-brand">
            {c.home}
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={path("/projects")}
            className="text-muted no-underline hover:text-brand"
          >
            {c.projects}
          </Link>
          {area && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={path(`/areas/${area.slug}`)}
                className="text-muted no-underline hover:text-brand"
              >
                {area.name}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-ink">{p.name}</span>
        </nav>
      </div>

      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      {p.photos.length > 0 && (
        <div className="wrap pt-6">
          <div className="grid gap-2 min-[760px]:grid-cols-[2fr_1fr]">
            <div className="relative aspect-[4/3] min-[760px]:aspect-[3/2] rounded-md overflow-hidden bg-brand-900">
              <Image
                src={mediaUrl(p.photos[0].src)!}
                alt={p.photos[0].alt ?? `${p.name}, ${area?.name ?? "Panama"}`}
                fill
                priority
                sizes="(max-width: 760px) 100vw, 66vw"
                className="object-cover"
              />
            </div>
            {p.photos.length > 1 && (
              <div className="grid grid-cols-2 min-[760px]:grid-cols-1 gap-2">
                {p.photos.slice(1, 3).map((ph, i) => (
                  <div
                    key={ph.src}
                    className="relative aspect-[4/3] rounded-md overflow-hidden bg-brand-900"
                  >
                    <Image
                      src={mediaUrl(ph.src)!}
                      alt={ph.alt ?? `${p.name} — ${i + 2}`}
                      fill
                      sizes="(max-width: 760px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          {p.photos.length > 3 && (
            <p className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.077em] text-faint">
              {c.photosFromDeveloper(p.photos.length)}
            </p>
          )}
        </div>
      )}

      {/* ── Header + body ───────────────────────────────────────────────── */}
      <div className="wrap grid gap-[clamp(24px,3vw,44px)] py-[clamp(28px,4vw,44px)] min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {p.status && (
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-accent-700">
              {statusLabelFor(locale, p.status)}
            </p>
          )}
          <h1 className="h1-article mt-2">{p.name}</h1>
          {area && (
            <p className="dek mt-3">
              <Link
                href={path(`/areas/${area.slug}`)}
                className="text-link no-underline hover:underline font-semibold"
              >
                {area.name}
              </Link>
              , {area.region}
            </p>
          )}

          {p.priceFromUsd ? (
            <p className="font-display text-[clamp(30px,4vw,40px)] font-bold tracking-[-0.0204em] text-ink tnum mt-5 leading-none">
              {c.priceFrom} {usd(p.priceFromUsd)}
              {p.priceToUsd && p.priceToUsd !== p.priceFromUsd && (
                <span className="text-muted font-semibold text-[24px]">
                  {" "}
                  {c.priceTo} {usd(p.priceToUsd)}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-5 text-[16px] font-semibold text-muted">
              {c.noVerifiedPrice}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 min-[560px]:grid-cols-4 gap-4 py-5 border-y border-line">
            {facts.map((f, i) => (
              <div key={`${f.k}-${i}`}>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-faint">
                  {f.k}
                </dt>
                <dd className="font-display text-[17px] font-bold text-ink tnum mt-1">
                  {f.v}
                </dd>
              </div>
            ))}
          </dl>

          {editorial?.hook && (
            <Prose className="mt-6 max-w-[70ch] [&_p]:text-[17px]">
              {editorial.hook}
            </Prose>
          )}

          {/* Prices and floor plans — the most searched thing about any named
              development, and the asset no competitor publishes. */}
          {p.models.length > 0 && (
            <section className="mt-10">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {c.pricesHeading(p.name)}
              </h2>
              <div className="mt-5 overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse text-[15.5px] min-w-[520px]">
                  <thead>
                    <tr>
                      {c.tableHeads.map((h) => (
                        <th
                          key={h}
                          className="bg-white font-display text-[14.5px] font-bold text-left text-ink border-b-2 border-brand-800 whitespace-nowrap px-4 py-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.models.map((m, i) => (
                      <tr key={`${m.name}-${i}`} className="hover:bg-paper-warm">
                        <td className="border-t border-line-soft px-4 py-3 font-semibold text-ink">
                          {m.name ?? "—"}
                        </td>
                        <td className="border-t border-line-soft px-4 py-3 font-mono tnum text-body">
                          {m.beds ?? "—"}
                        </td>
                        <td className="border-t border-line-soft px-4 py-3 font-mono tnum text-body">
                          {m.baths ?? "—"}
                        </td>
                        <td className="border-t border-line-soft px-4 py-3 font-mono tnum text-body">
                          {m.sizeM2 != null ? m2(m.sizeM2) : "—"}
                        </td>
                        <td className="border-t border-line-soft px-4 py-3 font-mono tnum text-ink font-semibold">
                          {usd(m.priceFromUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <SourceNote>
                  {c.pricedNote(
                    prices.length,
                    p.models.length,
                    editorial?.priceCheckedOn ?? null,
                  )}
                </SourceNote>
              </div>
            </section>
          )}

          {editorial?.locationNote && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {c.locationHeading(p.name)}
              </h2>
              <Prose className="mt-5 max-w-[70ch]">{editorial.locationNote}</Prose>
            </section>
          )}

          {p.amenities.length > 0 && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {c.includedHeading(p.name)}
              </h2>
              <ul className="mt-5 grid gap-2.5 min-[560px]:grid-cols-2">
                {p.amenities.map((a) => (
                  <li
                    key={a}
                    className="flex items-start gap-2.5 text-[15.5px] text-body"
                  >
                    <span
                      aria-hidden
                      className="mt-[9px] w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                    />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(editorial?.suits || editorial?.drawbacks) && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {c.suitsHeading(p.name)}
              </h2>
              {editorial.suits && (
                <Prose className="mt-5 max-w-[70ch]">{editorial.suits}</Prose>
              )}
              {editorial.drawbacks && (
                <Prose className="mt-4 max-w-[70ch]">{editorial.drawbacks}</Prose>
              )}
            </section>
          )}

          {/* Before you buy — the differentiator, on the page where a buyer is
              closest to committing money. */}
          <section className="mt-12">
            <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
              {c.beforeHeading(p.name)}
            </h2>
            <div className="mt-5 rounded-md border-l-4 border-line bg-paper-warm p-6 max-w-[70ch]">
              <TitleBadge
                status={editorial?.titleStatus ?? "unknown"}
                locale={locale}
              />
              <Prose className="mt-3.5">
                {editorial?.buyingNote ?? editorial?.titleNote ?? c.beforeFallback}
              </Prose>
              <Link
                href={c.titleGuideHref}
                className="inline-block mt-4 font-semibold text-link no-underline hover:underline"
              >
                {c.titleGuideLabel}
              </Link>
            </div>
          </section>

          {editorial && editorial.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {c.faqHeading}
              </h2>
              <div className="mt-5 flex flex-col gap-3">
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
            </section>
          )}
        </div>

        {/* ── Sticky lead card — the conversion surface ──────────────────── */}
        <aside className="min-[900px]:sticky min-[900px]:top-[92px] min-[900px]:self-start">
          <div className="rounded-md border border-line bg-white shadow-md p-6">
            <h2 className="font-display text-[20px] font-bold text-ink leading-tight">
              {c.askHeading(p.name)}
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
              {c.askBody}
            </p>

            <form
              id="lead-form"
              action="/api/lead"
              method="post"
              className="mt-5 flex flex-col gap-3"
            >
              <input type="hidden" name="project" value={p.slug} />
              <input type="hidden" name="area" value={area?.name ?? ""} />
              {/* Asking about a named development is the warmest signal on the
                  site. See 0006_lead_intent.sql. */}
              <input type="hidden" name="intent" value="project" />
              {/* /api/lead reads this rather than the Referer, because a page
                  knows its own locale and a header can be stripped. Emitted
                  only for non-English, matching article-cta.tsx: readLang()
                  already defaults an absent value to "en". */}
              {locale !== "en" && (
                <input type="hidden" name="lang" value={locale} />
              )}
              <LeadAttribution />
              <LeadFormError />

              {/* Honeypot. The field NAME stays `bot-field` in every locale —
                  renaming it per language switches the filter off. */}
              <div className="hidden" aria-hidden>
                <label htmlFor="lead-bot">
                  {t ? t.honeypotLabel : "Leave this empty"}
                </label>
                <input id="lead-bot" name="bot-field" tabIndex={-1} />
              </div>

              <label className="sr-only" htmlFor="lead-name">
                {t ? t.fieldName : "Name"}
              </label>
              <input
                id="lead-name"
                name="full_name"
                required
                placeholder={t ? t.fieldName : "Name"}
                className="w-full rounded-sm border border-line px-3.5 py-2.5 text-[16px] focus:border-brand outline-none"
              />
              <label className="sr-only" htmlFor="lead-email">
                {t ? t.fieldEmail : "Email"}
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                required
                placeholder={t ? t.fieldEmail : "Email"}
                className="w-full rounded-sm border border-line px-3.5 py-2.5 text-[16px] focus:border-brand outline-none"
              />
              <label className="sr-only" htmlFor="lead-phone">
                {t ? t.fieldPhone : "Phone or WhatsApp"}
              </label>
              <input
                id="lead-phone"
                name="phone"
                type="tel"
                placeholder={t ? t.fieldPhone : "Phone or WhatsApp"}
                className="w-full rounded-sm border border-line px-3.5 py-2.5 text-[16px] focus:border-brand outline-none"
              />

              <Turnstile />

              <button
                type="submit"
                className="mt-1 font-display text-[16px] font-bold px-6 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer"
              >
                {c.submit}
              </button>
            </form>

            {/* Decision 6: on the German tree this sits ABOVE the privacy note,
                not in small print. A project enquiry is the warmest lead on the
                site and the worst place to let someone find out afterwards. */}
            {t && (
              <p className="mt-4 text-[13px] font-semibold text-body">
                {t.repliesInEnglish}
              </p>
            )}
            <p className="mt-4 pt-4 border-t border-line text-[13px] text-muted">
              {t
                ? t.privacyNote
                : "We pass your details to one licensed broker and no one else."}
            </p>
          </div>

          {p.websiteUrl && (
            <p className="mt-4 text-[13.5px] text-muted">
              {c.developerSite}{" "}
              <a
                href={p.websiteUrl}
                rel="nofollow noopener"
                target="_blank"
                className="text-link no-underline hover:underline"
              >
                {c.developerSiteLink}
              </a>
            </p>
          )}
        </aside>
      </div>

      {/* ── Related ─────────────────────────────────────────────────────── */}
      {siblings.length > 0 && area && (
        <section className="bg-paper-warm border-y border-line py-[clamp(44px,6vw,72px)]">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">
              {c.siblingsHeading(area.name)}
            </h2>
            <div className="mt-8 grid gap-6 min-[680px]:grid-cols-3">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={path(`/projects/${s.slug}`)}
                  className="group rounded-md border border-line bg-white overflow-hidden no-underline shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {s.photos[0] && (
                    <div className="relative aspect-[16/10] bg-brand-900">
                      <Image
                        src={mediaUrl(s.photos[0].src)!}
                        alt={s.name}
                        fill
                        sizes="33vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="font-display text-[17px] font-bold text-ink group-hover:text-brand transition-colors">
                      {s.name}
                    </p>
                    <p className="mt-1.5 font-display text-[19px] font-bold text-ink tnum">
                      {c.priceFrom} {usd(s.priceFromUsd)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
