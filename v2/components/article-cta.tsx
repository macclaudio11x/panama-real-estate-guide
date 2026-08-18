import Link from "next/link";
import { LeadAttribution, LeadFormError } from "@/components/lead-attribution";
import { Turnstile } from "@/components/turnstile";
import { type PageLocale, lead as leadStrings, leadCopy, localePath } from "@/lib/i18n";

/* =============================================================================
   Article lead capture
   =============================================================================
   Until this existed, an article's only conversion surface was a card in the
   sidebar, and that sidebar is `hidden min-[860px]:grid`. A third of sessions
   are mobile, so a third of readers met no call to action at all beyond the
   header button. The card was also hardcoded once for all 54 guides: "Checking
   title on a specific property?" ran on the SIM-card guide and the pets guide.

   Two things follow from that, and they are the whole design of this file.

   FIRST: THE ASK MATCHES THE PAGE. Someone reading about rainy season is not
   evaluating a deposit. The copy is keyed to the category, because that is the
   coarsest split that is always true. Anything finer would need per-article
   copy that nobody will maintain.

   SECOND: THE ASK IS THE SERVICE, NOT A DOWNLOAD. What this site sells is
   access to a licensed broker, so that is what the block asks, in the words a
   reader would use: do you need a broker in Panama, do you need help finding a
   property, do you need help relocating. A guide give-away would collect more
   addresses and fewer buyers, and it would put a mailing list between the
   reader and the only thing we can actually do for them.

   The form is short because it sits in the middle of a guide, not because the
   ask is small. Three fields is what a reader will fill in without leaving the
   page; the contact form is still there for anyone ready to give a budget and
   a timeline, and every block links to it.

   Everyone who submits one of these has asked to be contacted, so they are
   ordinary broker leads and are treated as such — see `article` in
   lib/leads.ts. The only thing that makes them different is that nobody asked
   them for a budget, and the broker's alert says so rather than leaving them
   to discover it on the call.
   ============================================================================= */

type Tone = "quiet" | "strong" | "rail";

type Copy = { heading: string; body: string; button: string };

/* One entry per category in lib/content.ts. Each is the question that page's
   readers are actually sitting on, asked plainly, and each answers it with the
   one thing this site can do: put them with a licensed broker.

   The buying and money guides are read by people looking for a property. The
   residency and living guides are read by people working out whether to move
   at all, so those ask about the move rather than the purchase. */
const COPY: Record<string, Copy> = {
  buying: {
    heading: "Do you need a broker in Panama?",
    body: "We'll put you with a licensed one who actually works the area you're reading about. They'll tell you what's for sale, what it's really selling for, and which titles are clean before you commit to anything.",
    button: "Talk to a broker",
  },
  money: {
    heading: "Do you need help finding a property in your budget?",
    body: "Tell us roughly what you're working with and a licensed broker will come back with what it buys, where. No obligation, and nobody quotes you a price before you know the title status.",
    button: "Talk to a broker",
  },
  residency: {
    heading: "Do you need help relocating to Panama?",
    body: "A licensed broker can walk you through how the residency route you're reading about fits with buying or renting here, and what you'd need in place before you move.",
    button: "Get help relocating",
  },
  living: {
    heading: "Do you need help relocating to Panama?",
    body: "If you're weighing up the move, a licensed broker who lives here can tell you what the areas are really like to live in, and what your money does in each of them.",
    button: "Get help relocating",
  },
};

/* A category we don't have copy for still gets a working form rather than no
   CTA — the failure mode of a missing key should be generic, not absent. */
const FALLBACK = COPY.buying;

/* ── Tone ──────────────────────────────────────────────────────────────────
   Three placements, three weights. The mid-article block is deliberately the
   quietest of them: it interrupts someone who is still reading, so it reads as
   an aside on the page's own paper rather than as an advertisement dropped
   into the column. The block at the end and the one in the rail have earned a
   stronger treatment, because by then the reader has either finished or has
   chosen not to.
   ------------------------------------------------------------------------ */

const shell: Record<Tone, string> = {
  quiet: "my-11 rounded-md border border-line border-l-[3px] border-l-accent bg-paper-warm p-[clamp(20px,3vw,28px)]",
  strong: "mt-12 rounded-md bg-brand-800 p-[clamp(22px,3.5vw,32px)]",
  rail: "rounded-md bg-brand-800 p-[22px]",
};

const onDark: Record<Tone, boolean> = { quiet: false, strong: true, rail: true };

export function ArticleCta({
  category,
  tone,
  formId,
  locale = "en",
}: {
  /** Always the ENGLISH category slug, in every locale. It keys the copy table
   *  and it is what the lead row records, so the two languages' leads stay
   *  comparable in the CRM. */
  category: string;
  tone: Tone;
  /** Unique per instance: an article renders up to three of these, and three
   *  elements sharing an id is invalid HTML that also breaks the #lead-form
   *  anchor /api/lead redirects a rejected submission back to. */
  formId: string;
  locale?: PageLocale;
}) {
  const t = locale === "en" ? null : leadStrings(locale);
  const copy = locale === "en" ? (COPY[category] ?? FALLBACK) : leadCopy(locale, category);
  const dark = onDark[tone];

  /* The rejection message belongs on exactly one form per page — the canonical
     one the error redirect actually scrolls to. Rendering it in all three would
     show the same failure three times down the page. */
  const isErrorTarget = formId === "lead-form";

  const field =
    "w-full rounded-sm border px-3.5 py-2.5 text-[16px] outline-none " +
    (dark
      ? "border-white/25 bg-white/10 text-white placeholder:text-white/55 focus:border-accent"
      : "border-line bg-white text-body placeholder:text-faint focus:border-brand");

  return (
    <section
      className={shell[tone]}
      aria-labelledby={`${formId}-heading`}
    >
      <h2
        id={`${formId}-heading`}
        className={`font-display font-bold leading-tight ${
          tone === "rail" ? "text-[19px]" : "text-[clamp(19px,2.2vw,23px)]"
        } ${dark ? "text-white" : "text-ink"}`}
      >
        {copy.heading}
      </h2>
      <p
        className={`mt-2.5 leading-relaxed ${
          tone === "rail" ? "text-[14.5px]" : "text-[15.5px]"
        } ${dark ? "text-white/85" : "text-body"}`}
      >
        {copy.body}
      </p>

      <form id={formId} action="/api/lead" method="post" className="mt-5">
        {/* Marks the lead as having come from a guide rather than the contact
            form: same wish for a broker, none of the qualifiers. The broker's
            alert and the confirmation email both branch on it. */}
        <input type="hidden" name="intent" value="article" />
        {/* Written by the route that rendered the form, not read off the
            browser. See 0015_lead_lang.sql. English forms omit it and the
            server reads a missing value as "en". */}
        {locale !== "en" && <input type="hidden" name="lang" value={locale} />}
        {/* utm_*, gclid, fbclid, page_path, referrer. Without page_path we
            could not tell which guide produced the lead. */}
        <LeadAttribution />
        {isErrorTarget && <LeadFormError />}

        {/* Honeypot, same convention as the contact form. */}
        <div className="hidden" aria-hidden>
          {/* Label translated, field NAME identical across locales — renaming
              `bot-field` per language would switch off the filter. */}
          <label htmlFor={`${formId}-bot`}>
            {t ? t.honeypotLabel : "Leave this empty"}
          </label>
          <input id={`${formId}-bot`} name="bot-field" tabIndex={-1} />
        </div>

        {/* Three across where there is room for it, stacked in the rail and in
            the narrower dark block at the foot of the article. */}
        <div
          className={
            tone === "quiet"
              ? "grid gap-3 min-[620px]:grid-cols-3"
              : "flex flex-col gap-3"
          }
        >
          <label className="sr-only" htmlFor={`${formId}-name`}>
            {t ? t.fieldName : "Name"}
          </label>
          <input
            id={`${formId}-name`}
            name="full_name"
            required
            autoComplete="name"
            placeholder={t ? t.fieldName : "Name"}
            className={field}
          />

          <label className="sr-only" htmlFor={`${formId}-email`}>
            {t ? t.fieldEmail : "Email"}
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t ? t.fieldEmail : "Email"}
            className={field}
          />

          {/* Optional, and deliberately offered: this market runs on WhatsApp,
              and /api/lead accepts a phone number in place of an email. */}
          <label className="sr-only" htmlFor={`${formId}-phone`}>
            {t ? t.fieldPhone : "Phone or WhatsApp"}
          </label>
          <input
            id={`${formId}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t ? t.fieldPhone : "Phone or WhatsApp"}
            className={field}
          />
        </div>

        {/* Verified server-side in /api/lead before anything is saved. It draws
            nothing unless Cloudflare wants an interaction, which is what makes
            it bearable to render three of these down one guide. */}
        <Turnstile className="mt-3" />

        <button
          type="submit"
          className={`mt-3 font-display text-[15.5px] font-bold px-6 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer ${
            tone === "quiet" ? "w-full min-[620px]:w-auto" : "w-full"
          }`}
        >
          {copy.button}
        </button>
      </form>

      {/* What happens to the details, in the same words the contact form and
          the footer use. Someone handing over a phone number in the middle of
          an article is owed that before they do it, not after. */}
      {/* Decision 6 of docs/localisation-plan.md, and it goes ABOVE the privacy
          note rather than in the small print at the bottom. Someone who has
          just read 2,500 words of German has every reason to expect a German
          call back; they should learn otherwise here, while they are deciding
          whether to type their number, not on the phone. */}
      {t && (
        <p
          className={`mt-4 text-[14px] leading-relaxed font-medium ${
            dark ? "text-white/85" : "text-body"
          }`}
        >
          {t.repliesInEnglish}
        </p>
      )}
      <p
        className={`mt-4 text-[13.5px] leading-relaxed ${
          dark ? "text-white/60" : "text-muted"
        }`}
      >
        {t ? (
          t.privacyNote
        ) : (
          <>
            Email or phone, whichever you&rsquo;d rather. We pass your details to
            one licensed broker and no one else, and there&rsquo;s no newsletter.
          </>
        )}
      </p>
      <p className={`mt-3 text-[14px] ${dark ? "text-white/80" : "text-body"}`}>
        <Link
          href={localePath(locale, "/contact")}
          className={`font-display font-semibold no-underline hover:underline ${
            dark ? "text-accent" : "text-link"
          }`}
        >
          {t ? (
            t.toFullForm
          ) : (
            <>
              Know your budget and timeline already? Send those instead and get a
              shortlist →
            </>
          )}
        </Link>
      </p>
    </section>
  );
}
