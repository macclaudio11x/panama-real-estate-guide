import Link from "next/link";
import { categories } from "@/lib/content";
import { Button } from "@/components/ui";
import {
  type PageLocale,
  categoryCopy,
  localePath,
  ui,
} from "@/lib/i18n";

/* `locale` defaults to "en" so every existing call site is unchanged. The
   German tree passes "de" and gets translated labels and localised hrefs from
   the same markup — one header, not two, which is what keeps the trees from
   drifting apart as the design moves. */
export function SiteHeader({ locale = "en" }: { locale?: PageLocale }) {
  const t = locale === "en" ? null : ui(locale);
  const path = (p: string) => localePath(locale, p);

  return (
    <header className="sticky top-0 z-50 h-[70px] bg-white/92 backdrop-blur-[10px] border-b border-line">
      <div className="wrap h-full flex items-center gap-8">
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
          <Link
            href={path("/areas")}
            className="font-display text-[14.5px] font-semibold text-body no-underline hover:text-brand transition-colors"
          >
            {t ? t.navAreas : "Areas"}
          </Link>
          <Link
            href={path("/projects")}
            className="font-display text-[14.5px] font-semibold text-body no-underline hover:text-brand transition-colors"
          >
            {t ? t.navProjects : "Projects"}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link
            href={path("/about")}
            className="hidden min-[1000px]:block font-display text-[14.5px] font-semibold text-muted no-underline hover:text-brand transition-colors"
          >
            {t ? t.navAbout : "How we work"}
          </Link>
          <Button href={path("/contact")} className="!px-5 !py-2.5 !text-[15px]">
            {t ? t.ctaTalkToUs : "Talk to us"}
          </Button>
        </div>
      </div>
    </header>
  );
}
