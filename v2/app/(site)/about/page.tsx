import type { Metadata } from "next";
import Link from "next/link";
import { authors } from "@/lib/content";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "How we work",
  description:
    "How we research, who reviews our guides, how we make money, and what we do when the honest answer is don't buy.",
};

/* The trust page carries the site's whole positioning. Specificity is the
   point — vague independence claims are worth nothing. */
const principles = [
  {
    heading: "Every figure carries a source and a date",
    body: "Tax rates, processing times, and price ranges move. We stamp each one with the month we last checked it and link the institution we checked it against. If a stamp is more than six months old, treat the number as stale and tell us.",
  },
  {
    heading: "Legal content is reviewed before it publishes",
    body: "Anything touching title, tax, or residency law is read by a licensed Panamanian attorney before it goes live. The reviewer is named on the guide. A byline without a named reviewer means the piece is general research, not reviewed advice.",
  },
  {
    heading: "We say when the answer is don't buy",
    body: "Rights of Possession land, projects with unresolved permits, and areas that don't suit the buyer in front of us all get said plainly. A guide that never discourages a purchase isn't a guide.",
  },
  {
    heading: "We don't sell coverage",
    body: "No developer pays to appear on this site, and no listing position is for sale. When a project is included, it's because it's relevant to the area, not because someone bought a slot.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,68px)]">
          <nav className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-white/70 mb-5">
            <Link href="/" className="text-white/70 underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">How we work</span>
          </nav>

          <h1 className="h1-article !text-white max-w-[20ch]">How we work</h1>
          <p className="dek !text-white/90 mt-5 max-w-[62ch]">
            Buying property abroad means trusting strangers with a lot of money.
            Here is exactly how we research, who checks our work, and how we get
            paid — so you can decide how much weight to give any of it.
          </p>
        </div>
      </section>

      <section className="py-[clamp(48px,6vw,80px)]">
        <div className="wrap grid gap-x-14 gap-y-10 min-[900px]:grid-cols-2">
          {principles.map((p) => (
            <div key={p.heading} className="max-w-[52ch]">
              <h2 className="font-display text-[21px] font-bold tracking-[-0.014em] text-ink leading-snug">
                {p.heading}
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-body">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How we make money — the disclosure that earns the rest ───────── */}
      <section className="bg-paper-warm border-y border-line py-[clamp(48px,6vw,72px)]">
        <div className="wrap">
          <p className="eyebrow mb-3">The commercial bit</p>
          <h2 className="h2-section max-w-[24ch]">How we make money</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-body max-w-[70ch]">
            When you send us your details, we pass them to one licensed broker,
            who pays us a referral fee if a purchase completes. That is our only
            revenue from you, and it does not change what our guides say — the
            editorial side has no view of which projects generate fees. You are
            never obliged to use that broker, and the guides are free and
            complete whether you do or not.
          </p>
        </div>
      </section>

      {/* ── Who writes this ─────────────────────────────────────────────── */}
      <section className="py-[clamp(48px,6vw,80px)]">
        <div className="wrap">
          <h2 className="h2-section max-w-[24ch]">Who writes this</h2>
          <div className="mt-9 grid gap-6 min-[720px]:grid-cols-2 max-w-[900px]">
            {authors.map((a) => (
              <div
                key={a.slug}
                className="rounded-md border border-line bg-white p-6"
              >
                <p className="font-display text-[18px] font-bold text-ink">
                  {a.name}
                </p>
                <p className="font-mono text-[11.5px] uppercase tracking-[0.077em] text-accent-700 mt-1.5">
                  {a.title}
                </p>
                <p className="mt-3.5 text-[15px] leading-relaxed text-muted">
                  {a.bio}
                </p>
                {a.credential && (
                  <p className="mt-3 text-[13.5px] text-negative">
                    {a.credential}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-md bg-brand-800 text-white p-[clamp(24px,4vw,40px)] flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-[clamp(20px,2.6vw,26px)] font-bold tracking-[-0.019em] text-white max-w-[26ch] leading-tight">
                Think we got something wrong?
              </h2>
              <p className="mt-2.5 text-white/85 max-w-[52ch]">
                Tell us. We publish corrections and update the verification date
                when we do.
              </p>
            </div>
            <Button href="/contact">Get in touch</Button>
          </div>
        </div>
      </section>
    </>
  );
}
