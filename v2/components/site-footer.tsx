import Link from "next/link";
import { categories } from "@/lib/content";
import { listAreas } from "@/lib/catalog";

const footerLink =
  "text-footer-text/85 text-[14.5px] no-underline hover:text-white transition-colors";

export async function SiteFooter() {
  const areas = await listAreas();
  return (
    <footer className="bg-brand-800 text-footer-text pt-[60px] pb-[30px]">
      <div className="wrap">
        <div className="grid gap-10 min-[1000px]:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-[38ch]">
            <p className="font-display font-bold text-[17px] tracking-[-0.0204em] text-white">
              Panama<span className="text-accent">RealEstate</span>Guide
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              Independent research on buying property in Panama. We do not
              accept payment for coverage, and we tell you when the honest
              answer is &ldquo;don&rsquo;t buy this.&rdquo;
            </p>
          </div>

          <div>
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-white mb-4">
              Guides
            </p>
            <ul className="space-y-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${c.slug}`} className={footerLink}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-white mb-4">
              Areas
            </p>
            <ul className="space-y-2.5">
              {areas.map((a) => (
                <li key={a.slug}>
                  <Link href={`/areas/${a.slug}`} className={footerLink}>
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-white mb-4">
              About
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/about" className={footerLink}>
                  How we work
                </Link>
              </li>
              <li>
                <Link href="/team" className={footerLink}>
                  Editorial team
                </Link>
              </li>
              <li>
                <Link href="/contact" className={footerLink}>
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Specificity in the footer is disproportionately load-bearing for
            trust. This is where the real disclosures go before launch. */}
        <div className="mt-12 pt-7 border-t border-white/10 text-[13px] leading-relaxed text-footer-text/70">
          <p className="max-w-[90ch]">
            Panama Real Estate Guide publishes general information, not legal,
            tax, or investment advice. We are not a licensed brokerage and we do
            not hold client funds. Property figures, tax rates, and processing
            times change — check the verification date on any number before you
            rely on it, and confirm your own situation with a licensed
            Panamanian attorney.
          </p>
          <p className="mt-5">© 2026 Panama Real Estate Guide</p>
        </div>
      </div>
    </footer>
  );
}
