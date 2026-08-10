import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { usd, m2, statusLabel, toPlainText } from "@/lib/content";
import { listProjects, getProject, getArea, getProjectsForArea } from "@/lib/catalog";
import { getProjectEditorial } from "@/lib/editorial";
import { Button, TitleBadge, SourceNote, Prose } from "@/components/ui";
import { LeadAttribution, LeadFormError } from "@/components/lead-attribution";
import { Turnstile } from "@/components/turnstile";
import { mediaUrl, absoluteMedia } from "@/lib/media";

/* =============================================================================
   Project detail — built to rank for the project's own name
   =============================================================================
   Someone searching "Pino Alto Boquete" wants four things: what it costs, what
   the units are, where it is, and when it delivers. Every H2 answers one of
   them, in that order, so the page matches the query intent rather than
   burying it under marketing copy.

   SEO structure carried here:
   · H1 is the project name verbatim — the exact keyword, once.
   · Per-project title, description, canonical, and OG image. v1 shipped ONE
     shared og:image across all 84 articles, pointing at a file not even in the
     repo. Each project uses its own first photograph.
   · JSON-LD: RealEstateListing wrapping an AggregateOffer with the real
     low/high price and unit count, plus BreadcrumbList.
   · The unit-model table is genuinely unique content no competitor has, which
     matters because it is the only substantial text on the page until the
     descriptions are rewritten.

   ⚠️ CONTENT GAP: Descripción EN in Airtable is v1's SEO-spam prose and is
   deliberately not rendered. Until real copy exists these pages are thin, and
   thin pages do not rank no matter how good the markup is.
   ============================================================================= */

export const revalidate = 60;

export async function generateStaticParams() {
  return (await listProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return {};
  const area = await getArea(p.areaSlug);
  const where = area ? `${area.name}, Panama` : "Panama";

  // Most project names already carry the area ("Pino Alto Boquete"), so only
  // append it when it is genuinely missing. Repeating it pushed titles past
  // 100 characters and Google truncated the tail.
  const areaSuffix =
    area && !p.name.toLowerCase().includes(area.name.toLowerCase())
      ? `, ${area.name}`
      : "";

  return {
    // Absolute, so the layout's "| Panama Real Estate Guide" suffix is not
    // appended. On a page whose whole job is ranking for the project's own
    // name, 26 characters of branding is 26 characters of truncation risk.
    title: { absolute: `${p.name}${areaSuffix} — prices & floor plans` },
    // A project we hold no verified price for says so rather than rendering
    // "from —", which reads as a broken template in a search result.
    description: p.priceFromUsd
      ? `${p.name} in ${where}. ${p.models.length} unit type${p.models.length === 1 ? "" : "s"} from ${usd(p.priceFromUsd)}${p.status ? `, ${statusLabel[p.status].toLowerCase()}` : ""}. Prices as listed by the developer.`
      : `${p.name} in ${where}${p.status ? `, ${statusLabel[p.status].toLowerCase()}` : ""}. We hold no independently verified pricing for this project.`,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: {
      title: `${p.name} — ${where}`,
      description: p.priceFromUsd
        ? `${p.models.length} unit types from ${usd(p.priceFromUsd)}.`
        : `No independently verified pricing.`,
      url: `/projects/${p.slug}`,
      type: "website",
      images: p.photos[0] ? [{ url: mediaUrl(p.photos[0].src)! }] : undefined,
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) notFound();

  const editorial = await getProjectEditorial(slug);
  const area = await getArea(p.areaSlug);
  const siblings = (await getProjectsForArea(p.areaSlug))
    .filter((x) => x.slug !== p.slug)
    .slice(0, 3);

  const prices = p.models
    .map((m) => m.priceFromUsd)
    .filter((n): n is number => typeof n === "number");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateListing",
        name: p.name,
        url: `https://panamarealestateguide.com/projects/${p.slug}`,
        image: p.photos.map(
          (ph) => absoluteMedia(ph.src),
        ),
        ...(area && {
          address: {
            "@type": "PostalAddress",
            addressLocality: area.name,
            addressRegion: area.region,
            addressCountry: "PA",
          },
        }),
        ...(p.priceFromUsd && {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: p.priceFromUsd,
            ...(p.priceToUsd && { highPrice: p.priceToUsd }),
            offerCount: p.models.length || 1,
          },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://panamarealestateguide.com/" },
          { "@type": "ListItem", position: 2, name: "Projects", item: "https://panamarealestateguide.com/projects" },
          { "@type": "ListItem", position: 3, name: p.name },
        ],
      },
      ...(editorial && editorial.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: editorial.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: toPlainText(f.a) },
              })),
            },
          ]
        : []),
    ],
  };

  // The price range is already stated in full directly above this row, so it
  // is not repeated here — and two separate facts both labelled "From" read as
  // a bug even when the values are right.
  const facts = [
    p.models.length ? { k: "Unit types", v: String(p.models.length) } : null,
    p.sizeFromM2 != null ? { k: "Smallest unit", v: m2(p.sizeFromM2) } : null,
    p.bedsMin != null
      ? {
          k: "Bedrooms",
          v: p.bedsMin === p.bedsMax ? `${p.bedsMin}` : `${p.bedsMin}–${p.bedsMax}`,
        }
      : null,
    p.status ? { k: "Status", v: statusLabel[p.status] } : null,
    area ? { k: "Area", v: area.name } : null,
  ].filter((f): f is { k: string; v: string } => f !== null);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <div className="border-b border-line bg-paper-warm">
        <nav className="wrap py-3.5 font-mono text-[11.5px] uppercase tracking-[0.077em] text-muted">
          <Link href="/" className="text-muted no-underline hover:text-brand">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/projects"
            className="text-muted no-underline hover:text-brand"
          >
            Projects
          </Link>
          {area && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={`/areas/${area.slug}`}
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

      {/* ── Gallery — portal convention: one lead image + a thumb strip ──── */}
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
                      alt={ph.alt ?? `${p.name} — view ${i + 2}`}
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
              {p.photos.length} photos from the developer
            </p>
          )}
        </div>
      )}

      {/* ── Header + body ───────────────────────────────────────────────── */}
      <div className="wrap grid gap-[clamp(24px,3vw,44px)] py-[clamp(28px,4vw,44px)] min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {p.status && (
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-accent-700">
              {statusLabel[p.status]}
            </p>
          )}
          <h1 className="h1-article mt-2">{p.name}</h1>
          {area && (
            <p className="dek mt-3">
              <Link
                href={`/areas/${area.slug}`}
                className="text-link no-underline hover:underline font-semibold"
              >
                {area.name}
              </Link>
              , {area.region}
            </p>
          )}

          {/* No verified price means no price slot. Rendering "from —" here
              would look like a bug; saying nothing and letting the editorial
              explain the gap is the honest version. */}
          {p.priceFromUsd ? (
            <p className="font-display text-[clamp(30px,4vw,40px)] font-bold tracking-[-0.0204em] text-ink tnum mt-5 leading-none">
              from {usd(p.priceFromUsd)}
              {p.priceToUsd && p.priceToUsd !== p.priceFromUsd && (
                <span className="text-muted font-semibold text-[24px]">
                  {" "}
                  to {usd(p.priceToUsd)}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-5 text-[16px] font-semibold text-muted">
              No independently verified pricing
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

          {/* The hook — the one specific fact that stops this reading like a
              syndicated listing. Absent until a human has researched it. */}
          {editorial?.hook && (
            <Prose className="mt-6 max-w-[70ch] [&_p]:text-[17px]">
              {editorial.hook}
            </Prose>
          )}

          {/* H2 #1 — prices and floor plans. The single most searched thing
              about any named development, and our most unique content. */}
          {p.models.length > 0 && (
            <section className="mt-10">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {p.name} prices and floor plans
              </h2>
              <div className="mt-5 overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse text-[15.5px] min-w-[520px]">
                  <thead>
                    <tr>
                      {["Unit", "Beds", "Baths", "Size", "From"].map((h) => (
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
                  {prices.length} of {p.models.length} unit types priced · as
                  listed by the developer
                  {editorial?.priceCheckedOn && ` · checked ${editorial.priceCheckedOn}`}
                </SourceNote>
              </div>
            </section>
          )}

          {/* Where the project actually is — context, not coordinates. */}
          {editorial?.locationNote && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                Where {p.name} actually is
              </h2>
              <Prose className="mt-5 max-w-[70ch]">{editorial.locationNote}</Prose>
            </section>
          )}

          {/* H2 #2 — what's included */}
          {p.amenities.length > 0 && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                What&rsquo;s included at {p.name}
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

          {/* Who it suits, and who it doesn't — the section brokers can't
              write, because they earn on the sale either way. */}
          {(editorial?.suits || editorial?.drawbacks) && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                {`Who ${p.name} suits — and who it doesn’t`}
              </h2>
              {editorial.suits && (
                <Prose className="mt-5 max-w-[70ch]">{editorial.suits}</Prose>
              )}
              {editorial.drawbacks && (
                <Prose className="mt-4 max-w-[70ch]">{editorial.drawbacks}</Prose>
              )}
            </section>
          )}

          {/* H2 #3 — before you buy. The site's whole differentiator, on the
              page where a buyer is closest to committing money. */}
          <section className="mt-12">
            <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
              Before you buy at {p.name}
            </h2>
            <div className="mt-5 rounded-md border-l-4 border-line bg-paper-warm p-6 max-w-[70ch]">
              <TitleBadge status={editorial?.titleStatus ?? "unknown"} />
              <Prose className="mt-3.5">
                {editorial?.buyingNote ??
                  editorial?.titleNote ??
                  "We have not independently checked the title status, permits, or delivery record for this project. Everything on this page comes from the developer. Ask for the finca number and have an attorney pull the Registro Público entry before you pay a deposit of any size."}
              </Prose>
              <Link
                href="/buying/titled-vs-rights-of-possession"
                className="inline-block mt-4 font-semibold text-link no-underline hover:underline"
              >
                What to check, and how →
              </Link>
            </div>
          </section>

          {/* FAQ — 5–8 real questions, matching the FAQPage schema above. */}
          {editorial && editorial.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="h2-section !text-[clamp(23px,2.6vw,28px)]">
                FAQ
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
              Ask about {p.name}
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
              A licensed broker will follow up with availability, floor plans,
              and what the paperwork actually looks like.
            </p>

            <form id="lead-form" action="/api/lead" method="post" className="mt-5 flex flex-col gap-3">
              {/* Attribution: which page produced this lead. */}
              <input type="hidden" name="project" value={p.slug} />
              <input type="hidden" name="area" value={area?.name ?? ""} />
              {/* Asking about a named development is the warmest signal on the
                  site. See 0006_lead_intent.sql. */}
              <input type="hidden" name="intent" value="project" />
              {/* Campaign attribution — utm_*, gclid, fbclid, referrer. */}
              <LeadAttribution />
              <LeadFormError />

              {/* Honeypot, same convention as the contact form and the in-guide
                  block. This form was the only one of the three without one. */}
              <div className="hidden" aria-hidden>
                <label htmlFor="lead-bot">Leave this empty</label>
                <input id="lead-bot" name="bot-field" tabIndex={-1} />
              </div>

              <label className="sr-only" htmlFor="lead-name">
                Name
              </label>
              <input
                id="lead-name"
                name="full_name"
                required
                placeholder="Name"
                className="w-full rounded-sm border border-line px-3.5 py-2.5 text-[16px] focus:border-brand outline-none"
              />
              <label className="sr-only" htmlFor="lead-email">
                Email
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                required
                placeholder="Email"
                className="w-full rounded-sm border border-line px-3.5 py-2.5 text-[16px] focus:border-brand outline-none"
              />
              <label className="sr-only" htmlFor="lead-phone">
                Phone or WhatsApp
              </label>
              <input
                id="lead-phone"
                name="phone"
                type="tel"
                placeholder="Phone or WhatsApp"
                className="w-full rounded-sm border border-line px-3.5 py-2.5 text-[16px] focus:border-brand outline-none"
              />

              {/* Verified server-side in /api/lead before anything is saved. */}
              <Turnstile />

              <button
                type="submit"
                className="mt-1 font-display text-[16px] font-bold px-6 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer"
              >
                Request details
              </button>
            </form>

            <p className="mt-4 pt-4 border-t border-line text-[13px] text-muted">
              We pass your details to one licensed broker and no one else.
            </p>
          </div>

          {p.websiteUrl && (
            <p className="mt-4 text-[13.5px] text-muted">
              Developer&rsquo;s own site:{" "}
              <a
                href={p.websiteUrl}
                rel="nofollow noopener"
                target="_blank"
                className="text-link no-underline hover:underline"
              >
                view listing
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
              Other projects in {area.name}
            </h2>
            <div className="mt-8 grid gap-6 min-[680px]:grid-cols-3">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={`/projects/${s.slug}`}
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
                      from {usd(s.priceFromUsd)}
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
