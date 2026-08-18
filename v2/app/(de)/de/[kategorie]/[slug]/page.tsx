import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listTranslations, relatedTranslations } from "@/lib/articles";
import { getArticleFull } from "@/lib/editorial";
import { mediaUrl, absoluteMedia } from "@/lib/media";
import {
  categoryCopy,
  categorySlug,
  categorySlugToEn,
  credential,
  ui,
} from "@/lib/i18n";
import {
  extractHeadings,
  markdownComponents,
} from "@/components/article-markdown";
import { ArticleCta } from "@/components/article-cta";

export const revalidate = 60;

const t = ui("de");

/* Same rule as the English route: the `##` nearest the middle, and no mid
   block at all under four headings. Duplicated rather than shared because it
   is a placement decision about where a form interrupts a reader, and the two
   trees are free to answer it differently as the German set grows. */
function splitForCta(markdown: string): [string, string | null] {
  const headings = [...markdown.matchAll(/^##\s+.+$/gm)];
  if (headings.length < 4) return [markdown, null];
  const at = headings[Math.floor(headings.length / 2)].index;
  if (at === undefined || at === 0) return [markdown, null];
  return [markdown.slice(0, at), markdown.slice(at)];
}

/* Only rows that exist get a param. `dynamicParams` stays at its default true
   so a translation published through the MCP after the last build renders on
   first request — same contract as the English route. */
export async function generateStaticParams() {
  return (await listTranslations("de")).map((a) => ({
    kategorie: categorySlug("de", a.categorySlug),
    slug: a.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kategorie: string; slug: string }>;
}): Promise<Metadata> {
  const { kategorie, slug } = await params;
  const enCategory = categorySlugToEn("de", kategorie);
  if (!enCategory) return {};
  const article = await getArticleFull(enCategory, slug, "de");
  if (!article) return {};

  /* The cover image is shared with the English row and is not translated. Its
     alt text on the page is empty, so nothing language-specific is asserted. */
  const og = article.ogImagePath ? absoluteMedia(article.ogImagePath) : null;
  const searchTitle = article.seoTitle ?? article.title;
  const searchDescription = article.metaDescription ?? article.dek ?? undefined;

  return {
    title: { absolute: searchTitle },
    description: searchDescription,
    alternates: { canonical: `/de/${kategorie}/${slug}` },
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      url: `/de/${kategorie}/${slug}`,
      type: "article",
      /* de_DE, not the bare `de` that hreflang uses. Open Graph takes the
         regional form; hreflang must not. See lib/i18n.ts. */
      locale: "de_DE",
      ...(og && { images: [{ url: og, width: 1200, height: 675, alt: article.title }] }),
    },
    ...(og && { twitter: { card: "summary_large_image", images: [og] } }),
  };
}

export default async function GermanArticlePage({
  params,
}: {
  params: Promise<{ kategorie: string; slug: string }>;
}) {
  const { kategorie, slug } = await params;

  /* Unknown German segment, or the English segment under the German prefix:
     404 before touching the database. */
  const enCategory = categorySlugToEn("de", kategorie);
  if (!enCategory) notFound();

  /* getArticleFull with a locale never falls back to English. An untranslated
     slug 404s hard, which is a §7 gate and the single rule this tree exists to
     hold: a /de/ URL serving English prose under a German hreflang tag is
     duplicate content and a bad answer at once. */
  const article = await getArticleFull(enCategory, slug, "de");
  if (!article) notFound();

  const copy = categoryCopy("de", enCategory);
  const related = await relatedTranslations("de", enCategory, slug);
  const sections = article.body ? extractHeadings(article.body) : [];
  const [bodyTop, bodyRest] = splitForCta(article.body ?? "");

  /* Written by the translator, per §7a. Falls back to the English author only
     so a row with no translator still renders a byline rather than an
     anonymous page; the publish constraint requires translator_id, so this
     can only be reached by a draft. */
  const writer = article.translator ?? article.author;
  const url = `https://panamarealestateguide.com/de/${kategorie}/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.dek ?? undefined,
        url,
        inLanguage: "de",
        ...(article.ogImagePath && { image: [absoluteMedia(article.ogImagePath)] }),
        ...(writer && { author: { "@type": "Person", name: writer.name } }),
        /* NO `reviewedBy`, deliberately, and this is not an oversight to fix
           later. It asserts that a credentialled reviewer read THIS page, and
           on a translation nobody has. The credit line in the byline says the
           true thing instead: who signed the English source. See §7a. */
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t.home, item: "https://panamarealestateguide.com/de" },
          { "@type": "ListItem", position: 2, name: copy?.name ?? kategorie, item: `https://panamarealestateguide.com/de/${kategorie}` },
          { "@type": "ListItem", position: 3, name: article.title },
        ],
      },
      ...(article.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              inLanguage: "de",
              mainEntity: article.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band pb-24">
        <div className="wrap pt-[clamp(32px,4.5vw,52px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/de" className="text-white/70 underline">
              {t.home}
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/de/${kategorie}`} className="text-white/70 underline">
              {copy?.name ?? kategorie}
            </Link>
          </nav>

          <h1 className="h1-article !text-white max-w-[22ch]">{article.title}</h1>
          {article.dek && (
            <p className="dek !text-white/90 mt-5 max-w-[62ch]">{article.dek}</p>
          )}

          <hr className="border-0 h-px bg-accent/45 my-6" />

          {/* ── Byline, per §7a of docs/german-launch-plan.md ──────────────
              Three separate credits and no accuracy badge. The English page
              can say a licensed reviewer read it; this page cannot, because
              David Aguirre does not read German. What it can say — and does —
              is who wrote the German, who checked the German, and who signed
              the English source it was written from.

              `checked_by` is NOT here. It is the internal language gate and it
              never renders; the visible German-fidelity credit is a separate
              editorial line the plan settles per page. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {writer && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/55">
                  {t.writtenBy}
                </p>
                <p className="font-display text-[15px] font-bold text-white mt-0.5">
                  {writer.name}
                </p>
              </div>
            )}
            {article.sourceReviewer && (
              <div className="flex items-center gap-3.5">
                {article.sourceReviewer.avatarUrl && (
                  <Image
                    src={article.sourceReviewer.avatarUrl}
                    alt=""
                    width={52}
                    height={52}
                    className="size-13 shrink-0 rounded-full object-cover object-[56%_18%] ring-[1.5px] ring-accent/45"
                  />
                )}
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/55">
                    {t.sourceReviewedBy}
                  </p>
                  <p className="font-display text-[15px] font-bold text-white mt-0.5">
                    {article.sourceReviewer.name}
                    {article.sourceReviewer.credential && (
                      <span className="block font-mono text-[11.5px] font-normal text-white/60 mt-0.5">
                        {credential("de", article.sourceReviewer.credential)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
            {article.readMinutes && (
              <div className="min-[700px]:ml-auto">
                <span className="font-mono text-[12.5px] text-white/70 tnum">
                  {article.readMinutes} {t.readMinutes}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Body + sidebar ──────────────────────────────────────────────── */}
      <div className="wrap grid gap-[clamp(24px,3vw,36px)] min-[860px]:grid-cols-[minmax(0,1fr)_320px] pb-[clamp(48px,6vw,80px)]">
        <article className="min-w-0 bg-white rounded-lg shadow-lg -mt-14 p-[clamp(20px,3vw,40px)]">
          {article.ogImagePath && (
            <Image
              src={mediaUrl(article.ogImagePath)!}
              alt=""
              width={1200}
              height={675}
              priority
              className="w-full h-auto rounded-md mb-[clamp(20px,3vw,32px)]"
            />
          )}
          {/* Two `.prose` blocks with the capture form between them, exactly as
              the English route does it. `.prose` styles its descendants by
              element, so a form nested inside would inherit link colours and
              heading sizes meant for editorial copy; sitting between two
              blocks it inherits nothing.

              `enCategory`, not `kategorie` — the CTA copy table and the lead
              row are both keyed on the English slug, which is what keeps the
              two languages' leads comparable in the CRM. */}
          {article.body && (
            <>
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {bodyTop}
                </ReactMarkdown>
              </div>
              {bodyRest && (
                <>
                  <ArticleCta
                    category={enCategory}
                    tone="quiet"
                    formId="lead-form-inline"
                    locale="de"
                  />
                  <div className="prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {bodyRest}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </>
          )}

          <div className="prose">
            {article.faqs.length > 0 && (
              <>
                <h2 id="faq">{t.faqHeading}</h2>
                <div className="flex flex-col gap-3">
                  {article.faqs.map((f, i) => (
                    <div key={i} className="rounded-md border border-line p-5">
                      <p className="font-display text-[15.5px] font-bold text-ink">
                        {f.q}
                      </p>
                      <p className="mt-2 text-[15px] leading-relaxed text-body">
                        {f.a}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Source titles stay in their own language — most are Spanish
                government documents, and translating a title is how a reader
                loses the ability to find the document. Only the label around
                them is German. */}
            {article.sources.length > 0 && (
              <div className="max-w-[760px] mt-10 border-t border-line pt-6">
                <p className="font-display text-[14px] font-bold uppercase tracking-[0.077em] text-ink">
                  {t.sourcesHeading}
                </p>
                <ol className="mt-3 text-[15px]">
                  {article.sources.map((s, i) => (
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
                        <span className="text-faint">
                          {" "}
                          — {t.sourceCheckedOn} {s.checkedOn}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* The one block every reader reaches on every breakpoint. The rail
              below is desktop-only. */}
          <ArticleCta
            category={enCategory}
            tone="strong"
            formId="lead-form"
            locale="de"
          />
        </article>

        <aside className="hidden min-[860px]:grid gap-6 content-start">
          {sections.length > 0 && (
            <nav className="border-y border-line py-5">
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-ink">
                {t.onThisPage}
              </p>
              <ul className="mt-3.5 space-y-2.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-[14.5px] text-muted no-underline hover:text-brand"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="sticky top-[110px]">
            <ArticleCta
              category={enCategory}
              tone="rail"
              formId="lead-form-rail"
              locale="de"
            />
          </div>
        </aside>
      </div>

      {/* ── Related ─────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="bg-paper-warm border-y border-line py-[clamp(48px,7vw,88px)]">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">{t.keepReading}</h2>
            <div className="mt-9 grid gap-[22px] min-[620px]:grid-cols-2 min-[1000px]:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/de/${categorySlug("de", r.categorySlug)}/${r.slug}`}
                  className="group rounded-md border border-line bg-white p-6 no-underline shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {r.ogImagePath && (
                    <Image
                      src={mediaUrl(r.ogImagePath)!}
                      alt=""
                      width={480}
                      height={270}
                      className="w-full h-auto rounded-sm mb-5"
                    />
                  )}
                  <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-accent-700">
                    {categoryCopy("de", r.categorySlug)?.name ?? r.categorySlug}
                  </p>
                  <h3 className="mt-3 font-display text-[18px] font-semibold leading-snug text-ink group-hover:text-brand transition-colors">
                    {r.title}
                  </h3>
                  <p className="mt-4 font-mono text-[12px] text-faint tnum">
                    {[r.readMinutes && `${r.readMinutes} ${t.readMinutes}`, r.updatedOn]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
