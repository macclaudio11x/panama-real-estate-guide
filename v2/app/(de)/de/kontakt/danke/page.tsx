import type { Metadata } from "next";
import { Button } from "@/components/ui";
import { lead as leadStrings } from "@/lib/i18n";

/* A native form post has nowhere to put a success message, so it needs a page.
   German gets its own rather than sharing /contact/thanks: landing on an
   English confirmation after submitting a German form is the moment a reader
   decides the German site is a veneer.

   Added to the robots disallow list alongside /contact/thanks. */

const t = leadStrings("de");

export const metadata: Metadata = {
  title: t.thanksTitle,
  description: t.thanksBody,
  robots: { index: false, follow: false },
};

export default async function GermanThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <section className="hero-band">
      <div className="wrap py-[clamp(48px,7vw,88px)]">
        <p className="font-display text-[12px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
          {t.thanksEyebrow}
        </p>
        <h1 className="h1-article !text-white max-w-[20ch]">{t.thanksTitle}</h1>
        <p className="dek !text-white/90 mt-5 max-w-[58ch]">{t.thanksBody}</p>

        {ref && (
          <p className="mt-6 font-mono text-[14px] text-white/75">
            {t.thanksReference}:{" "}
            <span className="text-accent tnum">{ref}</span>
          </p>
        )}

        <div className="mt-9">
          <Button href="/de">{t.thanksBack}</Button>
        </div>
      </div>
    </section>
  );
}
