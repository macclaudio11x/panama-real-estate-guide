import type { Metadata } from "next";
import { Button } from "@/components/ui";

/* A native form post has nowhere to put a success message, so it needs a page.
   This one is also the Google Ads conversion target, which is why it has a
   stable URL rather than a query flag back on /contact. */

export const metadata: Metadata = {
  title: "Thanks — we have your details",
  description: "We have your enquiry. A licensed broker follows up, usually within one business day.",
  // A confirmation page has nothing to rank for, and indexing it would put a
  // conversion page into search results ahead of the form that feeds it.
  robots: { index: false, follow: false },
};

export default async function LeadThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <>
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,64px)]">
          <p className="font-display text-[12px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            Enquiry received
          </p>
          <h1 className="h1-article !text-white max-w-[20ch]">
            Thanks — we have your details
          </h1>
          {ref && (
            <p className="dek !text-white/90 mt-5">
              Your reference is{" "}
              <span className="font-mono text-white">{ref}</span>. Quote it if
              you get in touch before we do.
            </p>
          )}
        </div>
      </section>

      <section className="py-[clamp(44px,6vw,72px)]">
        <div className="wrap max-w-[640px]">
          <h2 className="font-display text-[19px] font-bold text-ink">
            What happens next
          </h2>
          <ol className="mt-5 space-y-4 text-[16px] leading-relaxed text-body list-decimal pl-5">
            <li>
              We read what you sent and rule out the areas that fit worst. That
              part is done by a person, not a mailing list.
            </li>
            <li>
              You get a shortlist with title status and delivery dates attached,
              usually within one business day.
            </li>
            <li>A licensed broker calls to talk it through.</li>
          </ol>

          <p className="mt-8 pt-6 border-t border-line text-[15px] text-muted">
            Nothing else happens to your details. We pass them to one licensed
            broker, we don&rsquo;t sell them, and we don&rsquo;t add you to a
            mailing list you didn&rsquo;t ask for.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="/buying">Read the buying guides</Button>
            <Button href="/projects" variant="secondary">
              Browse projects
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
