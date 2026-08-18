import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { categories } from "@/lib/content";
import { listArticles, relatedArticles } from "@/lib/articles";
import { getArticleFull } from "@/lib/editorial";
import { mediaUrl, absoluteMedia } from "@/lib/media";
import { ArticleCta } from "@/components/article-cta";
import {
  extractHeadings,
  markdownComponents,
} from "@/components/article-markdown";

/* Supabase is the source of truth for article content, so the routes have to
   re-read it. 60s means an edit made through the MCP is live within a minute
   without a deploy; `dynamicParams` stays at its default true, so an article
   created after the last build renders on first request rather than 404ing. */
export const revalidate = 60;

export async function generateStaticParams() {
  return (await listArticles()).map((a) => ({
    category: a.categorySlug,
    slug: a.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticleFull(category, slug);
  if (!article) return {};
  // v1 shipped one shared og:image across every article, pointing at a file
  // that was not even in the repo. An article without its own image gets none,
  // which at least lets the crawler fall back to the site default.
  const og = article.ogImagePath ? absoluteMedia(article.ogImagePath) : null;
  // `seo_title`/`meta_description` override the headline and standfirst in
  // search results only, and are null on most articles. See migration 0007.
  const searchTitle = article.seoTitle ?? article.title;
  const searchDescription = article.metaDescription ?? article.dek ?? undefined;

  return {
    // Absolute, matching the project route. The layout template appends
    // "| Panama Real Estate Guide", which is 27 of the ~60 characters Google
    // shows before it truncates. On an article whose title is already carrying
    // the keyword, that is a quarter of the budget spent on branding the
    // domain name already communicates.
    title: { absolute: searchTitle },
    description: searchDescription,
    alternates: { canonical: `/${category}/${slug}` },
    openGraph: {
      // Deliberately the headline, not the search override. A share card sits
      // next to a link someone is about to open, so it should say what the page
      // says. The SEO fields exist to win a click in a ranked list, which is a
      // different job.
      title: article.title,
      description: article.dek ?? undefined,
      url: `/${category}/${slug}`,
      type: "article",
      ...(og && { images: [{ url: og, width: 1200, height: 675, alt: article.title }] }),
    },
    ...(og && { twitter: { card: "summary_large_image", images: [og] } }),
  };
}

/* =============================================================================
   Where the mid-article CTA goes
   =============================================================================
   At the `##` nearest the middle, so a reader who leaves at 60% has still been
   asked once. Splitting on a heading rather than a paragraph count is what
   keeps it from landing between a sentence and the table that proves it.

   Articles with fewer than four headings are returned whole and get no mid
   block. Under roughly a thousand words the end-of-article CTA is already in
   view, and a capture form two screens into a short guide interrupts more than
   it converts.
   ============================================================================= */
function splitForCta(markdown: string): [string, string | null] {
  const headings = [...markdown.matchAll(/^##\s+.+$/gm)];
  if (headings.length < 4) return [markdown, null];

  const at = headings[Math.floor(headings.length / 2)].index;
  if (at === undefined || at === 0) return [markdown, null];

  return [markdown.slice(0, at), markdown.slice(at)];
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const article = await getArticleFull(category, slug);
  if (!article) notFound();

  const cat = categories.find((c) => c.slug === category);
  const related = await relatedArticles(category, slug);
  const sections = article.body ? extractHeadings(article.body) : [];
  const [bodyTop, bodyRest] = splitForCta(article.body ?? "");
  const reviewedForAccuracy = Boolean(article.reviewer && article.reviewedOn);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.dek ?? undefined,
        url: `https://panamarealestateguide.com/${category}/${slug}`,
        ...(article.ogImagePath && { image: [absoluteMedia(article.ogImagePath)] }),
        ...(article.author && { author: { "@type": "Person", name: article.author.name } }),
        ...(reviewedForAccuracy && article.reviewer && {
          reviewedBy: { "@type": "Person", name: article.reviewer.name },
        }),
        ...(article.reviewedOn && { dateModified: article.reviewedOn }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://panamarealestateguide.com/" },
          { "@type": "ListItem", position: 2, name: cat?.name ?? category, item: `https://panamarealestateguide.com/${category}` },
          { "@type": "ListItem", position: 3, name: article.title },
        ],
      },
      ...(article.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
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
            <Link href="/" className="text-white/70 underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/${category}`} className="text-white/70 underline">
              {cat?.name ?? category}
            </Link>
          </nav>

          <h1 className="h1-article !text-white max-w-[22ch]">
            {article.title}
          </h1>
          {article.dek && (
            <p className="dek !text-white/90 mt-5 max-w-[62ch]">
              {article.dek}
            </p>
          )}

          <hr className="border-0 h-px bg-accent/45 my-6" />

          {/* Byline — writer and reviewer, both named, both real. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {article.author && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/55">
                  Written by
                </p>
                <p className="font-display text-[15px] font-bold text-white mt-0.5">
                  {article.author.name}
                </p>
              </div>
            )}
            {article.reviewer && (
              <div className="flex items-center gap-3.5">
                {article.reviewer.avatarUrl && (
                  <Image
                    src={article.reviewer.avatarUrl}
                    alt=""
                    width={52}
                    height={52}
                    /* Portrait crop: the source is a 2:3 standing shot, so pull
                       the square toward the top so the circle lands on the face. */
                    className="size-13 shrink-0 rounded-full object-cover object-[56%_18%] ring-[1.5px] ring-accent/45"
                  />
                )}
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/55">
                    Reviewed by
                  </p>
                  <p className="font-display text-[15px] font-bold text-white mt-0.5">
                    {article.reviewer.name}
                    {article.reviewer.credential && (
                      <span className="block font-mono text-[11.5px] font-normal text-white/60 mt-0.5">
                        {article.reviewer.credential}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
            <div className="min-[700px]:ml-auto flex items-center gap-5">
              {/* Only shown when a named reviewer actually signed off with a
                  date — a badge with nothing behind it is worse than no badge. */}
              {reviewedForAccuracy && (
                <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#e8d269] px-3.5 py-1 font-display text-[11.5px] font-bold uppercase tracking-[0.077em] text-[#f3e08a]">
                  ✓ Reviewed for accuracy
                </span>
              )}
              {article.readMinutes && (
                <span className="font-mono text-[12.5px] text-white/70 tnum">
                  {article.readMinutes} min
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body + sidebar ──────────────────────────────────────────────── */}
      <div className="wrap grid gap-[clamp(24px,3vw,36px)] min-[860px]:grid-cols-[minmax(0,1fr)_320px] pb-[clamp(48px,6vw,80px)]">
        <article className="min-w-0 bg-white rounded-lg shadow-lg -mt-14 p-[clamp(20px,3vw,40px)]">
          {/* Cover art, when the article has its own. Illustrated, never a
              photorealistic rendering of a real place or building — a fake
              photograph of a named property is a fabricated source in a format
              nobody can audit. Deliberately not decorative filler: an article
              without an image renders without a hole where one would be. */}
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
          {/* The body renders as one or two `.prose` blocks. Two when a mid
              article CTA is going between them: `.prose` styles its
              descendants by element (`.prose a`, `.prose h2`), so a capture
              block nested inside would inherit link colours and heading sizes
              meant for editorial copy. Sitting between two blocks, it inherits
              nothing. */}
          {article.body ? (
            <>
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {bodyTop}
                </ReactMarkdown>
              </div>
              {bodyRest && (
                <>
                  <ArticleCta
                    category={category}
                    tone="quiet"
                    formId="lead-form-inline"
                  />
                  <div className="prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {bodyRest}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="prose text-muted">This guide hasn&rsquo;t been written yet.</p>
          )}

          <div className="prose">
            {article.faqs.length > 0 && (
              <>
                <h2 id="faq">Frequently asked questions</h2>
                <div className="flex flex-col gap-3">
                  {article.faqs.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-line p-5"
                    >
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

            {article.sources.length > 0 && (
              <div className="max-w-[760px] mt-10 border-t border-line pt-6">
                <p className="font-display text-[14px] font-bold uppercase tracking-[0.077em] text-ink">
                  Sources
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
                        <span className="text-faint"> — checked {s.checkedOn}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* The one CTA every reader reaches, on every breakpoint. The rail
              below is desktop-only, so before this existed a mobile reader
              finished a guide and was offered nothing but the next guide. */}
          <ArticleCta category={category} tone="strong" formId="lead-form" />
        </article>

        {/* ── Sidebar ────────────────────────────────────────────────────────
            The column itself is NOT sticky, only the CTA inside it is.

            It used to be the other way round, which worked while the rail held
            a two-line card and a button. The card is now a form, and a long
            table of contents plus a form is taller than most viewports: pinning
            the whole column at top-110px meant everything above the fold of it
            — the heading and all three fields — sat behind the header and could
            never be scrolled to. Letting the contents list scroll away and
            pinning only the form keeps the sticky thing shorter than the
            screen, which is the condition sticky positioning actually needs. */}
        <aside className="hidden min-[860px]:grid gap-6 content-start">
          {sections.length > 0 && (
            <nav className="border-y border-line py-5">
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-ink">
                On this page
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
            <ArticleCta category={category} tone="rail" formId="lead-form-rail" />
          </div>
        </aside>
      </div>

      {/* ── Related ─────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="bg-paper-warm border-y border-line py-[clamp(48px,7vw,88px)]">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">Keep reading</h2>
            <div className="mt-9 grid gap-[22px] min-[620px]:grid-cols-2 min-[1000px]:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.categorySlug}/${r.slug}`}
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
                    {r.categorySlug}
                  </p>
                  <h3 className="mt-3 font-display text-[18px] font-semibold leading-snug text-ink group-hover:text-brand transition-colors">
                    {r.title}
                  </h3>
                  <p className="mt-4 font-mono text-[12px] text-faint tnum">
                    {[r.readMinutes && `${r.readMinutes} min`, r.updatedOn].filter(Boolean).join(" · ")}
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
