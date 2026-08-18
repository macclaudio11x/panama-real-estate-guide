import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categories } from "@/lib/content";
import { listTranslationsIn } from "@/lib/articles";
import { mediaUrl } from "@/lib/media";
import { categoryCopy, categorySlug, categorySlugToEn, ui } from "@/lib/i18n";

export const revalidate = 60;

const t = ui("de");

/* The four categories exist in German by construction — `CATEGORY_SLUGS` in
   lib/i18n.ts is exhaustive over lib/content.ts — so this needs no database
   round trip and every German category index is prerendered. */
export function generateStaticParams() {
  return categories.map((c) => ({ kategorie: categorySlug("de", c.slug) }));
}

/* Resolve a German URL segment back to the English identifier the data layer
   uses. Returns null on anything unknown, INCLUDING the English slug itself:
   `/de/buying` must 404 rather than render, or the same page has two URLs and
   we have manufactured the duplicate-content problem hreflang exists to fix. */
function resolve(kategorie: string) {
  const enSlug = categorySlugToEn("de", kategorie);
  if (!enSlug) return null;
  const copy = categoryCopy("de", enSlug);
  if (!copy) return null;
  return { enSlug, copy };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kategorie: string }>;
}): Promise<Metadata> {
  const { kategorie } = await params;
  const hit = resolve(kategorie);
  if (!hit) return {};
  return {
    title: { absolute: hit.copy.metaTitle },
    description: hit.copy.metaDescription,
    alternates: { canonical: `/de/${kategorie}` },
  };
}

export default async function GermanCategoryPage({
  params,
}: {
  params: Promise<{ kategorie: string }>;
}) {
  const { kategorie } = await params;
  const hit = resolve(kategorie);
  if (!hit) notFound();
  const { enSlug, copy } = hit;

  /* Translated rows only. A category whose German guides have not been written
     renders empty and says so — it never lists the English ones. */
  const inCategory = await listTranslationsIn("de", enSlug);
  const siblings = categories.filter((c) => c.slug !== enSlug);

  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,64px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/de" className="text-white/70 underline">
              {t.home}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{copy.name}</span>
          </nav>

          <p className="font-display text-[12px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            {copy.name}
          </p>
          <h1 className="h1-article !text-white max-w-[18ch]">{copy.blurb}</h1>

          <hr className="border-0 h-px bg-accent/45 my-6" />

          {/* The English hub says "Written and reviewed by our editorial team".
              That claim does not carry over: nobody credentialled has read the
              German text, which is the whole reason §7a drops the accuracy
              badge. The count is a fact and stays. */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[12.5px] text-white/70">
            <span className="tnum">{t.guidesCount(inCategory.length)}</span>
          </div>
        </div>
      </section>

      {/* ── Sibling categories ──────────────────────────────────────────── */}
      <section className="border-b border-line py-5">
        <div className="wrap flex flex-wrap gap-2.5">
          {siblings.map((c) => (
            <Link
              key={c.slug}
              href={`/de/${categorySlug("de", c.slug)}`}
              className="rounded-full border border-line px-4 py-1.5 font-display text-[13.5px] font-semibold text-body no-underline hover:border-brand hover:text-brand transition-colors"
            >
              {categoryCopy("de", c.slug)?.name ?? c.name}
            </Link>
          ))}
          {/* No Regionen chip: /de/regionen is a later ship. */}
        </div>
      </section>

      {/* ── Guides ──────────────────────────────────────────────────────── */}
      <section className="py-[clamp(48px,6vw,80px)]">
        <div className="wrap">
          <h2 className="h2-section max-w-[24ch]">
            {inCategory.length > 0
              ? `${copy.name}: Ratgeber auf Deutsch`
              : t.emptyCategory}
          </h2>

          {inCategory.length === 0 ? (
            <p className="dek mt-4 max-w-[58ch]">{t.emptyCategoryBody}</p>
          ) : (
            <div className="mt-9 grid gap-[22px] min-[620px]:grid-cols-2 min-[1000px]:grid-cols-3">
              {inCategory.map((a) => (
                <Link
                  key={a.slug}
                  href={`/de/${categorySlug("de", a.categorySlug)}/${a.slug}`}
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
                    {[a.readMinutes && `${a.readMinutes} ${t.readMinutes}`, a.updatedOn]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {/* The English hub closes with a lead-capture block pointing at
              /contact. Omitted rather than translated: the German contact form,
              the `leads.lang` column and the line telling a German reader the
              broker replies in English are all E4. A CTA that lands on a 404,
              or that quietly switches language, costs more than no CTA. */}
        </div>
      </section>
    </>
  );
}
