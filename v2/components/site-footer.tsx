import Link from "next/link";
import { categories } from "@/lib/content";
import { listAreas } from "@/lib/catalog";
import {
  type PageLocale,
  categoryCopy,
  localePath,
  sectionIsLive,
  ui,
} from "@/lib/i18n";

const footerLink =
  "text-footer-text/85 text-[14.5px] no-underline hover:text-white transition-colors";

/* Same contract as SiteHeader: `locale` defaults to "en" and the English
   footer is unchanged. The German tree passes "de" and gets its strings from
   lib/i18n.ts and its hrefs from localePath.

   The area column and the About links are gated on `sectionIsLive` rather than
   translated, because German has no /regionen, /so-arbeiten-wir or /kontakt
   route yet. A footer full of dead links is a worse first impression than a
   short footer, and it is the sort of thing nobody notices until a reader
   reports it. */
export async function SiteFooter({ locale = "en" }: { locale?: PageLocale }) {
  const t = locale === "en" ? null : ui(locale);
  const path = (p: string) => localePath(locale, p);
  const live = (s: string) => sectionIsLive(locale, s);
  const areas = live("areas") ? await listAreas() : [];

  return (
    <footer className="bg-brand-800 text-footer-text pt-[60px] pb-[30px]">
      <div className="wrap">
        <div className="grid gap-10 min-[1000px]:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-[38ch]">
            <p className="font-display font-bold text-[17px] tracking-[-0.0204em] text-white">
              Panama<span className="text-accent">RealEstate</span>Guide
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              {t ? (
                t.footerBlurb
              ) : (
                <>
                  Independent research on buying property in Panama. We do not
                  accept payment for coverage, and we tell you when the honest
                  answer is &ldquo;don&rsquo;t buy this.&rdquo;
                </>
              )}
            </p>
          </div>

          <div>
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-white mb-4">
              {t ? t.footerGuides : "Guides"}
            </p>
            <ul className="space-y-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={path(`/${c.slug}`)} className={footerLink}>
                    {locale === "en" ? c.name : (categoryCopy(locale, c.slug)?.name ?? c.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {areas.length > 0 && (
            <div>
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-white mb-4">
                {t ? t.footerAreas : "Areas"}
              </p>
              <ul className="space-y-2.5">
                {areas.map((a) => (
                  <li key={a.slug}>
                    <Link href={path(`/areas/${a.slug}`)} className={footerLink}>
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(live("about") || live("contact")) && (
            <div>
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-white mb-4">
                {t ? t.footerAbout : "About"}
              </p>
              <ul className="space-y-2.5">
                {live("about") && (
                  <>
                    <li>
                      <Link href={path("/about")} className={footerLink}>
                        {t ? t.navAbout : "How we work"}
                      </Link>
                    </li>
                    <li>
                      <Link href={path("/team")} className={footerLink}>
                        {t ? t.footerEditorialTeam : "Editorial team"}
                      </Link>
                    </li>
                  </>
                )}
                {live("contact") && (
                  <li>
                    <Link href={path("/contact")} className={footerLink}>
                      {t ? t.navContact : "Contact"}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Specificity in the footer is disproportionately load-bearing for
            trust. This is where the real disclosures go before launch. */}
        <div className="mt-12 pt-7 border-t border-white/10 text-[13px] leading-relaxed text-footer-text/70">
          <p className="max-w-[90ch]">
            {t ? (
              t.disclaimer
            ) : (
              <>
                Panama Real Estate Guide publishes general information, not
                legal, tax, or investment advice. We are not a licensed
                brokerage and we do not hold client funds. Property figures, tax
                rates, and processing times change — check the verification date
                on any number before you rely on it, and confirm your own
                situation with a licensed Panamanian attorney.
              </>
            )}
          </p>
          <p className="mt-5">© 2026 Panama Real Estate Guide</p>
        </div>
      </div>
    </footer>
  );
}
