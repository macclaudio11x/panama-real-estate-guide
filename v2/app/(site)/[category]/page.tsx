import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categories } from "@/lib/content";
import { listArticlesIn } from "@/lib/articles";
import { mediaUrl } from "@/lib/media";
import { Button } from "@/components/ui";

export const revalidate = 60;

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = categories.find((c) => c.slug === category);
  if (!cat) return {};
  return {
    title: `${cat.name} guides for buying property in Panama`,
    description: cat.blurb,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = categories.find((c) => c.slug === category);
  if (!cat) notFound();

  const inCategory = await listArticlesIn(category);
  const siblings = categories.filter((c) => c.slug !== category);

  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,64px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/" className="text-white/70 underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{cat.name}</span>
          </nav>

          <p className="font-display text-[12px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            {cat.name}
          </p>
          <h1 className="h1-article !text-white max-w-[18ch]">{cat.blurb}</h1>

          <hr className="border-0 h-px bg-accent/45 my-6" />

          {/* Meta row — the LeyConsulta hub signature. */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[12.5px] text-white/70">
            <span>Written and reviewed by our editorial team</span>
            <span className="tnum">
              {inCategory.length} guide{inCategory.length === 1 ? "" : "s"}
            </span>
            <span>Updated July 2026</span>
          </div>
        </div>
      </section>

      {/* ── Sibling categories ──────────────────────────────────────────── */}
      <section className="border-b border-line py-5">
        <div className="wrap flex flex-wrap gap-2.5">
          {siblings.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="rounded-full border border-line px-4 py-1.5 font-display text-[13.5px] font-semibold text-body no-underline hover:border-brand hover:text-brand transition-colors"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href="/areas"
            className="rounded-full border border-line px-4 py-1.5 font-display text-[13.5px] font-semibold text-body no-underline hover:border-brand hover:text-brand transition-colors"
          >
            Areas
          </Link>
        </div>
      </section>

      {/* ── Guides ──────────────────────────────────────────────────────── */}
      <section className="py-[clamp(48px,6vw,80px)]">
        <div className="wrap">
          <h2 className="h2-section max-w-[24ch]">
            {inCategory.length > 0
              ? `Guides on ${cat.name.toLowerCase()}`
              : "Nothing published here yet"}
          </h2>

          {inCategory.length === 0 ? (
            <p className="dek mt-4 max-w-[58ch]">
              We&rsquo;re still researching this section. In the meantime, tell
              us what you need to know and we&rsquo;ll answer directly.
            </p>
          ) : (
            <div className="mt-9 grid gap-[22px] min-[620px]:grid-cols-2 min-[1000px]:grid-cols-3">
              {inCategory.map((a) => (
                <Link
                  key={a.slug}
                  href={`/${a.categorySlug}/${a.slug}`}
                  className="group rounded-md border border-line bg-white p-6 no-underline shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {a.ogImagePath && (
                    <Image
                      src={mediaUrl(a.ogImagePath)!}
                      alt=""
                      width={480}
                      height={270}
                      className="w-full h-auto rounded-sm mb-5"
                    />
                  )}
                  <h3 className="font-display text-[18px] font-semibold leading-snug text-ink group-hover:text-brand transition-colors">
                    {a.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">
                    {a.dek}
                  </p>
                  <p className="mt-5 font-mono text-[12px] text-faint tnum">
                    {[a.readMinutes && `${a.readMinutes} min`, a.updatedOn].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-12 rounded-md bg-brand-800 text-white p-[clamp(24px,4vw,40px)] flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-[clamp(20px,2.6vw,26px)] font-bold tracking-[-0.019em] text-white max-w-[26ch] leading-tight">
                Still not sure how this applies to your situation?
              </h2>
              <p className="mt-2.5 text-white/85 max-w-[52ch]">
                Send us the specifics. We&rsquo;ll tell you what to check before
                you commit to anything.
              </p>
            </div>
            <Button href="/contact">Ask us</Button>
          </div>
        </div>
      </section>
    </>
  );
}
