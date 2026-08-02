import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { articles, categories } from "@/lib/content";
import { getArticleFull } from "@/lib/editorial";
import { ArticleChart, parseChartSpec } from "@/components/article-chart";
import { Button } from "@/components/ui";

export function generateStaticParams() {
  return articles.map((a) => ({ category: a.categorySlug, slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticleFull(category, slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.dek ?? undefined,
    alternates: { canonical: `/${category}/${slug}` },
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      url: `/${category}/${slug}`,
      type: "article",
    },
  };
}

/* Slug function shared by the heading renderer and the TOC extraction below,
   so an anchor link always lands on the heading that produced it. */
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function extractHeadings(markdown: string) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return matches.map((m) => ({ id: slugify(m[1]), label: m[1] }));
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
  const related = articles
    .filter((a) => a.slug !== slug || a.categorySlug !== category)
    .slice(0, 3);
  const sections = article.body ? extractHeadings(article.body) : [];
  const reviewedForAccuracy = Boolean(article.reviewer && article.reviewedOn);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.dek ?? undefined,
        url: `https://panamarealestateguide.com/${category}/${slug}`,
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
          <div className="prose">
            {article.body ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => (
                    <h2 id={slugify(String(children))}>{children}</h2>
                  ),
                  table: ({ children }) => (
                    <div className="table-scroll">
                      <table>{children}</table>
                    </div>
                  ),
                  /* ```chart blocks render as a figure. Intercepted at `pre`
                     rather than `code` because react-markdown wraps fenced code
                     in <pre>, and a <figure> inside <pre> is invalid HTML that
                     would also inherit monospace styling. Reads the hast node
                     so the raw JSON is available before React escapes it.
                     Anything that is not a valid chart falls through to a
                     normal code block, so a typo shows the JSON rather than
                     breaking the page. */
                  pre: ({ node, children }) => {
                    const code = node?.children?.[0];
                    const cls =
                      code?.type === "element" ? code.properties?.className : null;
                    const isChart =
                      Array.isArray(cls) && cls.includes("language-chart");
                    if (isChart && code?.type === "element") {
                      const first = code.children?.[0];
                      const spec =
                        first?.type === "text"
                          ? parseChartSpec(first.value)
                          : null;
                      if (spec) return <ArticleChart spec={spec} />;
                    }
                    return <pre>{children}</pre>;
                  },
                }}
              >
                {article.body}
              </ReactMarkdown>
            ) : (
              <p className="text-muted">This guide hasn&rsquo;t been written yet.</p>
            )}

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
        </article>

        {/* ── Sticky sidebar ─────────────────────────────────────────────── */}
        <aside className="hidden min-[860px]:grid sticky top-[110px] gap-6 content-start">
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

          <div className="rounded-md p-[22px] bg-brand-800 text-white">
            <h3 className="font-display text-[19px] font-bold text-white leading-tight">
              Checking title on a specific property?
            </h3>
            <p className="mt-2.5 text-[14.5px] text-white/85 leading-relaxed">
              Send us the listing. We&rsquo;ll tell you what to ask for before
              you pay a deposit.
            </p>
            <Button href="/contact" className="mt-4 w-full">
              Get a check
            </Button>
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
                  <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-accent-700">
                    {r.categorySlug}
                  </p>
                  <h3 className="mt-3 font-display text-[18px] font-semibold leading-snug text-ink group-hover:text-brand transition-colors">
                    {r.title}
                  </h3>
                  <p className="mt-4 font-mono text-[12px] text-faint tnum">
                    {r.readMinutes} min · {r.updatedOn}
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
