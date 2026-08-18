import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { categories } from "@/lib/content";
import { listTranslations } from "@/lib/articles";
import { mediaUrl } from "@/lib/media";
import { categoryCopy, categorySlug, ui } from "@/lib/i18n";
import { alternatesForSection } from "@/lib/alternates";

export const revalidate = 60;

const t = ui("de");

/* =============================================================================
   German home
   =============================================================================
   Deliberately NOT a translation of the English home page. That page opens on
   a price collage, an entry-price chart and a strip of projects, all of which
   read from the catalogue — and the catalogue has no German rows. Rendering it
   in German would mean either English project copy under a German heading, or
   three empty sections.

   So this is its own page and a smaller one: what the site is, the four guide
   categories, and every guide that actually exists in German. It grows when
   the catalogue does, not before.
   ============================================================================= */

export const metadata: Metadata = {
  title: { absolute: "Panama Real Estate Guide — Wissen, was Sie kaufen" },
  description:
    "Unabhängige Ratgeber zum Immobilienkauf in Panama. Geprüfte Zahlen, Titelprüfung und Recherche vor Ort — auf Deutsch, für ausländische Käufer.",
  /* The same map the English home emits, with the canonical swapped. That is
     what reciprocal means, and building both sides from one function is what
     stops them drifting. */
  alternates: alternatesForSection("/", "de"),
};

export default async function GermanHomePage() {
  const articles = await listTranslations("de");

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-band">
        <div className="wrap py-[clamp(48px,7vw,88px)]">
          <h1 className="h1-home !text-white max-w-[20ch]">
            Wissen, was Sie in Panama kaufen
          </h1>
          <p className="dek !text-white/90 mt-6 max-w-[58ch]">{t.homeDek}</p>
        </div>
      </section>

      {/* ── The four categories ─────────────────────────────────────────── */}
      <section className="py-[clamp(48px,6vw,80px)]">
        <div className="wrap">
          <div className="grid gap-[22px] min-[620px]:grid-cols-2">
            {categories.map((c) => {
              const copy = categoryCopy("de", c.slug);
              return (
                <Link
                  key={c.slug}
                  href={`/de/${categorySlug("de", c.slug)}`}
                  className="group rounded-md border border-line bg-white p-7 no-underline shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <h2 className="font-display text-[21px] font-bold text-ink group-hover:text-brand transition-colors">
                    {copy?.name ?? c.name}
                  </h2>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
                    {copy?.blurb ?? c.blurb}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Everything published in German ──────────────────────────────── */}
      {articles.length > 0 && (
        <section className="bg-paper-warm border-y border-line py-[clamp(48px,7vw,88px)]">
          <div className="wrap">
            <h2 className="h2-section max-w-[24ch]">{t.homeGuidesHeading}</h2>
            <div className="mt-9 grid gap-[22px] min-[620px]:grid-cols-2 min-[1000px]:grid-cols-3">
              {articles.map((a) => (
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
                  <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-accent-700">
                    {categoryCopy("de", a.categorySlug)?.name ?? a.categorySlug}
                  </p>
                  <h3 className="mt-3 font-display text-[18px] font-semibold leading-snug text-ink group-hover:text-brand transition-colors">
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
          </div>
        </section>
      )}
    </>
  );
}
