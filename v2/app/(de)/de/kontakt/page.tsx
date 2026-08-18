import type { Metadata } from "next";
import { listAreas } from "@/lib/catalog";
import { LeadAttribution, LeadFormError } from "@/components/lead-attribution";
import { Turnstile } from "@/components/turnstile";
import { lead as leadStrings } from "@/lib/i18n";

/* The German long form. Same fields, same names, same endpoint as
   app/(site)/contact/page.tsx — a German lead and an English one are the same
   row shape, differing only in `lang`, so the broker's queue and every CRM
   view keep working without a second code path.

   What is NOT the same is the promise. Decision 6 of docs/localisation-plan.md:
   the broker takes German enquiries in English, and this page says so twice —
   once in the dek, before anyone starts filling anything in, and once in the
   "what happens next" rail. Neither is small print. */

const t = leadStrings("de");

export const metadata: Metadata = {
  title: { absolute: t.contactMetaTitle },
  description: t.contactMetaDescription,
  alternates: { canonical: "/de/kontakt" },
};

const field =
  "w-full rounded-sm border border-line bg-white px-3.5 py-2.5 text-[16px] text-body focus:border-brand outline-none";
const label =
  "block font-display text-[13px] font-bold uppercase tracking-[0.077em] text-ink mb-2";

/* The first entry of each list is the empty prompt, so it posts "" and
   `readLeadInput` collapses it to null rather than recording "Bitte wählen" as
   an answered question. */
function Select({
  id,
  name,
  options,
  required = false,
}: {
  id: string;
  name: string;
  options: readonly string[];
  required?: boolean;
}) {
  return (
    <select id={id} name={name} className={field} required={required}>
      {options.map((o, i) => (
        <option key={o} value={i === 0 ? "" : o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default async function GermanContactPage() {
  const areas = await listAreas();

  return (
    <>
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,64px)]">
          <p className="font-display text-[12px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            {t.contactEyebrow}
          </p>
          <h1 className="h1-article !text-white max-w-[20ch]">
            {t.contactTitle}
          </h1>
          <p className="dek !text-white/90 mt-5 max-w-[58ch]">{t.contactDek}</p>
          {/* Above the fold and above the form. Not a footnote. */}
          <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-white/85 border-l-2 border-accent pl-4">
            {t.repliesInEnglish}
          </p>
        </div>
      </section>

      <section className="py-[clamp(44px,6vw,72px)]">
        <div className="wrap grid gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
          <form
            id="lead-form"
            className="max-w-[640px]"
            action="/api/lead"
            method="post"
            aria-labelledby="lead-form-heading"
          >
            <h2 id="lead-form-heading" className="sr-only">
              {t.contactTitle}
            </h2>

            <LeadFormError />

            {/* Field NAME identical across locales. Renaming `bot-field` per
                language would switch off the filter that has caught every junk
                lead this site has received. */}
            <div className="hidden" aria-hidden>
              <label htmlFor="bot-field">{t.honeypotLabel}</label>
              <input id="bot-field" name="bot-field" tabIndex={-1} />
            </div>

            <LeadAttribution />
            <input type="hidden" name="intent" value="shortlist" />
            {/* Set by the route, not read from the browser. See
                0015_lead_lang.sql for why Accept-Language is the wrong source. */}
            <input type="hidden" name="lang" value="de" />

            <fieldset className="border-0 p-0 m-0">
              <legend className="font-display text-[19px] font-bold text-ink mb-2">
                {t.howToReachYou}
              </legend>
              <p className="text-[15px] text-muted mb-5 max-w-[52ch]">
                {t.howToReachYouNote}
              </p>
              <div className="grid gap-5 min-[560px]:grid-cols-2">
                <div>
                  <label className={label} htmlFor="name">
                    {t.fieldName}
                  </label>
                  <input
                    id="name"
                    name="full_name"
                    required
                    autoComplete="name"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="email">
                    {t.fieldEmail}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="phone">
                    {t.fieldPhone}
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="country">
                    {t.fieldCountry}
                  </label>
                  <input
                    id="country"
                    name="country"
                    autoComplete="country-name"
                    className={field}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="border-0 p-0 m-0 mt-10">
              <legend className="font-display text-[19px] font-bold text-ink mb-2">
                {t.whatYouWant}
              </legend>
              <p className="text-[15px] text-muted mb-5 max-w-[52ch]">
                {t.whatYouWantNote}
              </p>

              <div className="grid gap-5 min-[560px]:grid-cols-2">
                <div>
                  <label className={label} htmlFor="budget">
                    {t.fieldBudget}
                  </label>
                  <Select id="budget" name="budget" options={t.budgetOptions} required />
                </div>
                <div>
                  <label className={label} htmlFor="timeline">
                    {t.fieldTimeline}
                  </label>
                  <Select id="timeline" name="timeline" options={t.timelineOptions} required />
                </div>
              </div>

              {/* Native <details>, so it opens without JavaScript — the same
                  reason the form posts natively. A collapsed field is still
                  submitted, so nothing typed here is silently dropped. */}
              <details className="mt-6 rounded-sm border border-line bg-paper-warm px-5 py-4 [&[open]>summary]:mb-5">
                <summary className="cursor-pointer font-display text-[15px] font-bold text-brand marker:text-accent">
                  {t.moreDetail}
                </summary>

                <div className="grid gap-5 min-[560px]:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="financing">
                      {t.fieldFinancing}
                    </label>
                    <Select id="financing" name="financing" options={t.financingOptions} />
                  </div>
                  <div>
                    <label className={label} htmlFor="residency">
                      {t.fieldResidency}
                    </label>
                    <Select id="residency" name="residency" options={t.residencyOptions} />
                  </div>
                </div>

                {/* Area names are proper nouns and stay untranslated in every
                    locale — Boquete is Boquete. */}
                <div className="mt-5">
                  <label className={label} htmlFor="area">
                    {t.fieldAreas}
                  </label>
                  <select id="area" name="area" className={field}>
                    <option value="">{t.areasNoPreference}</option>
                    {areas.map((a) => (
                      <option key={a.slug}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <label className={label} htmlFor="notes">
                    {t.fieldNotes}
                  </label>
                  <textarea id="notes" name="notes" rows={4} className={field} />
                </div>
              </details>
            </fieldset>

            <div className="mt-8 flex items-start gap-3">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                className="mt-1.5"
              />
              <label htmlFor="consent" className="text-[14.5px] text-muted">
                {t.consent}
              </label>
            </div>

            <Turnstile className="mt-5" />

            <button
              type="submit"
              className="mt-7 inline-flex items-center justify-center font-display text-[16px] font-bold px-7 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer"
            >
              {t.submit}
            </button>
          </form>

          <aside className="min-[900px]:pt-2">
            <div className="rounded-md border border-line bg-paper-warm p-6">
              <h2 className="font-display text-[17px] font-bold text-ink">
                {t.whatHappensNext}
              </h2>
              <ol className="mt-4 space-y-4 text-[15px] leading-relaxed text-body list-decimal pl-5">
                {t.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="mt-5 pt-5 border-t border-line text-[14px] text-muted">
                {t.noSelling}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
