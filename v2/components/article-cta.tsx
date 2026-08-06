import Link from "next/link";
import { LeadAttribution, LeadFormError } from "@/components/lead-attribution";

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

   SECOND: THE ASK IS SMALL. The contact form wants eleven fields and gets a
   broker call in return, which is the right trade for a reader who has already
   chosen a building. For a reader three paragraphs into a comparison guide it
   is the wrong trade, and the site had nothing else to offer them. This asks
   for a name and an email, and returns the guides we already wrote.

   What it must never do is promise something we do not send. The email that
   answers a `brief` is assembled in lib/lead-notify.ts out of published guides
   on this site. No document is promised that does not exist, and nobody is
   told a broker will ring them when the form did not ask for a call.
   ============================================================================= */

type Tone = "quiet" | "strong" | "rail";

type Copy = { heading: string; body: string; button: string };

/* One entry per category in lib/content.ts. The hook is the thing that page's
   readers are actually deciding, stated the way the guides state it: what the
   record says, and where the record is silent. */
const COPY: Record<string, Copy> = {
  buying: {
    heading: "Before you pay a deposit",
    body: "Not all land in Panama is titled, and the difference is not always disclosed up front. We'll email you the three guides that explain what to verify and what it costs to get it wrong.",
    button: "Email me the three guides",
  },
  money: {
    heading: "What it actually costs",
    body: "The official cost-of-living figures and what foreigners really spend are two different numbers. We'll email you the three guides that separate them, with the source for every figure attached.",
    button: "Email me the three guides",
  },
  residency: {
    heading: "Which route you'd qualify for",
    body: "Three residency routes, three different thresholds, and most of what's written about them online is describing rules that changed. We'll email you the guides that cite the current requirements.",
    button: "Email me the guides",
  },
  living: {
    heading: "Still deciding whether it's Panama",
    body: "Most country comparisons repeat figures nobody sourced. We'll email you the guides that show where each number came from, so you can check them rather than trust us.",
    button: "Email me the guides",
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
}: {
  category: string;
  tone: Tone;
  /** Unique per instance: an article renders up to three of these, and three
   *  elements sharing an id is invalid HTML that also breaks the #lead-form
   *  anchor /api/lead redirects a rejected submission back to. */
  formId: string;
}) {
  const copy = COPY[category] ?? FALLBACK;
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

      <form
        id={formId}
        action="/api/lead"
        method="post"
        className={`mt-5 ${
          tone === "quiet"
            ? "grid gap-3 min-[560px]:grid-cols-[1fr_1fr_auto]"
            : "flex flex-col gap-3"
        }`}
      >
        {/* Marks this as a reader who wanted guides, not a call. The broker's
            alert and the confirmation email both branch on it. */}
        <input type="hidden" name="intent" value="brief" />
        {/* utm_*, gclid, fbclid, page_path, referrer. Without page_path we
            could not tell which guide produced the address. */}
        <LeadAttribution />
        {isErrorTarget && <LeadFormError />}

        {/* Honeypot, same convention as the contact form. */}
        <div className="hidden" aria-hidden>
          <label htmlFor={`${formId}-bot`}>Leave this empty</label>
          <input id={`${formId}-bot`} name="bot-field" tabIndex={-1} />
        </div>

        <label className="sr-only" htmlFor={`${formId}-name`}>
          First name
        </label>
        <input
          id={`${formId}-name`}
          name="full_name"
          required
          autoComplete="given-name"
          placeholder="First name"
          className={field}
        />

        <label className="sr-only" htmlFor={`${formId}-email`}>
          Email
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          className={field}
        />

        <button
          type="submit"
          className="font-display text-[15.5px] font-bold px-6 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          {copy.button}
        </button>
      </form>

      {/* The honest small print, and the escape hatch to the real form for
          anyone further along than this block assumes. A reader who already
          has a building in mind should not have to convert through the
          researcher's door. */}
      <p
        className={`mt-4 text-[13.5px] leading-relaxed ${
          dark ? "text-white/60" : "text-muted"
        }`}
      >
        The guides and nothing else. No newsletter, and we don&rsquo;t pass your
        address to a broker unless you ask us to.
      </p>
      <p className={`mt-3 text-[14px] ${dark ? "text-white/80" : "text-body"}`}>
        <Link
          href="/contact"
          className={`font-display font-semibold no-underline hover:underline ${
            dark ? "text-accent" : "text-link"
          }`}
        >
          Looking at a specific property? Get a shortlist with the title status
          attached →
        </Link>
      </p>
    </section>
  );
}
