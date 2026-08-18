import Link from "next/link";
import { ui } from "@/lib/i18n";

/* Catches every `notFound()` thrown under /de — an unknown category segment, a
   slug with no German translation, or a translation whose English source has
   been unpublished. It renders inside app/(de)/layout.tsx, so it carries
   `lang="de"` and the German chrome rather than the app's default 404.

   Reachable by design and often: the whole tree ships six pages at a time
   while the English side has fifty-four, so "not translated yet" is the normal
   case and the copy says so instead of implying the topic is uncovered.

   Not to be confused with the unmatched-URL 404, which renders
   `<html id="__next_error__">` with no lang and no fonts. That is pre-existing
   Next 16 behaviour, documented in docs/localisation-plan.md, and is fixed by
   `global-not-found.js` behind a next.config flag rather than from here. */
const t = ui("de");

export default function GermanNotFound() {
  return (
    <section className="wrap py-[clamp(64px,9vw,120px)]">
      <h1 className="h1-article max-w-[20ch]">{t.notFoundTitle}</h1>
      <p className="dek mt-5 max-w-[56ch]">{t.notFoundBody}</p>
      <p className="mt-8">
        <Link href="/de" className="text-link font-display font-semibold">
          {t.notFoundLink}
        </Link>
      </p>
    </section>
  );
}
