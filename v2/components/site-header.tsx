import Link from "next/link";
import { categories } from "@/lib/content";
import { Button } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  type PageLocale,
  categoryCopy,
  localePath,
  sectionIsLive,
  ui,
} from "@/lib/i18n";

/* `locale` defaults to "en" so every existing call site is unchanged. The
   German tree passes "de" and gets translated labels and localised hrefs from
   the same markup — one header, not two, which is what keeps the trees from
   drifting apart as the design moves. */
export function SiteHeader({ locale = "en" }: { locale?: PageLocale }) {
  const t = locale === "en" ? null : ui(locale);
  const path = (p: string) => localePath(locale, p);
  /* A locale only links to a section once that section has a route. German
     ships the four guide categories first, so its nav is guides-only until
     later ships turn `areas`, `projects`, `about` and `contact` on in
     LIVE_SECTIONS. Linking to a slug the router does not know is a 404 in the
     header of every page. */
  const live = (s: string) => sectionIsLive(locale, s);

  return (
    <header className="sticky top-0 z-50 h-[70px] bg-white/92 backdrop-blur-[10px] border-b border-line">
      {/* The gap tightens below the nav breakpoint. There are three flex
          children, so `gap-8` costs 64px before anything is drawn, and at
          375px the wordmark alone is 190px of a 339px content box. Desktop
          keeps the original spacing. */}
      <div className="wrap h-full flex items-center gap-3 min-[1000px]:gap-8">
        <Link
          href={path("/")}
          className="font-display font-bold text-[17px] tracking-[-0.0204em] text-ink no-underline shrink-0"
        >
          Panama<span className="text-brand">RealEstate</span>Guide
        </Link>

        <nav className="hidden min-[1000px]:flex items-center gap-7 ml-2">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={path(`/${c.slug}`)}
              className="font-display text-[14.5px] font-semibold text-body no-underline hover:text-brand transition-colors"
            >
              {locale === "en" ? c.name : (categoryCopy(locale, c.slug)?.name ?? c.name)}
            </Link>
          ))}
          {live("areas") && (
            <Link
              href={path("/areas")}
              className="font-display text-[14.5px] font-semibold text-body no-underline hover:text-brand transition-colors"
            >
              {t ? t.navAreas : "Areas"}
            </Link>
          )}
          {live("projects") && (
            <Link
              href={path("/projects")}
              className="font-display text-[14.5px] font-semibold text-body no-underline hover:text-brand transition-colors"
            >
              {t ? t.navProjects : "Projects"}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 min-[1000px]:gap-4">
          <LanguageSwitcher locale={locale} />
          {live("about") && (
            <Link
              href={path("/about")}
              className="hidden min-[1000px]:block font-display text-[14.5px] font-semibold text-muted no-underline hover:text-brand transition-colors"
            >
              {t ? t.navAbout : "How we work"}
            </Link>
          )}
          {live("contact") && (
            <Button href={path("/contact")} className="!px-5 !py-2.5 !text-[15px]">
              {t ? t.ctaTalkToUs : "Talk to us"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
