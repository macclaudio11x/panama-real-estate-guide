import type { Metadata } from "next";
import { listAreas } from "@/lib/catalog";
import { LeadAttribution, LeadFormError } from "@/components/lead-attribution";
import { Turnstile } from "@/components/turnstile";

export const metadata: Metadata = {
  title: "Get your shortlist",
  description:
    "Tell us your budget, timeline, and what you want out of the move. We'll send a shortlist with the title status of everything on it.",
};

const field =
  "w-full rounded-sm border border-line bg-white px-3.5 py-2.5 text-[16px] text-body focus:border-brand outline-none";
const label =
  "block font-display text-[13px] font-bold uppercase tracking-[0.077em] text-ink mb-2";

export default async function ContactPage() {
  return (
    <>
      <section className="hero-band">
        <div className="wrap py-[clamp(40px,6vw,64px)]">
          <p className="font-display text-[12px] font-bold uppercase tracking-[0.077em] text-accent mb-3">
            Talk to someone
          </p>
          <h1 className="h1-article !text-white max-w-[20ch]">
            Get your shortlist
          </h1>
          <p className="dek !text-white/90 mt-5 max-w-[58ch]">
            A licensed broker follows up — usually within one business day. You
            get the title status of everything on the list before anyone
            discusses price.
          </p>
        </div>
      </section>

      <section className="py-[clamp(44px,6vw,72px)]">
        <div className="wrap grid gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
          {/* Two-step in spirit: contact first, qualifiers second. The
              qualifiers are what make the lead worth a broker's call. */}
          <form
            id="lead-form"
            className="max-w-[640px]"
            action="/api/lead"
            method="post"
            aria-labelledby="lead-form-heading"
          >
            <h2 id="lead-form-heading" className="sr-only">
              Request a shortlist
            </h2>

            {/* Shown only after /api/lead redirects back with ?lead_error=. */}
            <LeadFormError />

            {/* Honeypot — matches the v1 form-capture convention. */}
            <div className="hidden" aria-hidden>
              <label htmlFor="bot-field">Leave this empty</label>
              <input id="bot-field" name="bot-field" tabIndex={-1} />
            </div>

            {/* utm_*, gclid, fbclid, page_path, referrer — see the component. */}
            <LeadAttribution />
            {/* This form is the one that asks for a broker call. See
                0006_lead_intent.sql for why that is recorded rather than
                assumed. */}
            <input type="hidden" name="intent" value="shortlist" />

            <fieldset className="border-0 p-0 m-0">
              <legend className="font-display text-[19px] font-bold text-ink mb-2">
                How to reach you
              </legend>
              {/* `email` used to be a required input while the database and
                  /api/lead both accept an email OR a phone number
                  (`lead_needs_a_contact_method` in 0001_init.sql). The form was
                  stricter than the thing behind it, and the people it turned
                  away were the WhatsApp-first buyers this market is full of.
                  The server still enforces that one of the two is present. */}
              <p className="text-[15px] text-muted mb-5 max-w-[52ch]">
                An email or a phone number, whichever you&rsquo;d rather we
                used. One of the two is enough.
              </p>
              <div className="grid gap-5 min-[560px]:grid-cols-2">
                <div>
                  <label className={label} htmlFor="name">
                    Name
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
                    Email
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
                    Phone or WhatsApp
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
                    Where you live now
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
                What you&rsquo;re looking for
              </legend>
              {/* Six optional questions used to sit open on the page under this
                  legend, which made a two-minute form look like a mortgage
                  application at the moment someone decides whether to start it.
                  Budget and timeline stay visible because they are what decide
                  whether a broker can build a shortlist at all; the rest moved
                  into the disclosure below. Nothing was removed, and no field
                  changed its name, so the broker still gets everything anyone
                  chooses to fill in. */}
              <p className="text-[15px] text-muted mb-5 max-w-[52ch]">
                These two answers are what let us rule areas out for you instead
                of sending a generic list.
              </p>

              <div className="grid gap-5 min-[560px]:grid-cols-2">
                <div>
                  <label className={label} htmlFor="budget">
                    Budget
                  </label>
                  <select id="budget" name="budget" className={field} required>
                    <option value="">Select a range</option>
                    <option>Under $150k</option>
                    <option>$150k – $300k</option>
                    <option>$300k – $600k</option>
                    <option>Over $600k</option>
                    <option>Not sure yet</option>
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="timeline">
                    Timeline
                  </label>
                  <select id="timeline" name="timeline" className={field} required>
                    <option value="">Select a timeline</option>
                    <option>Within 3 months</option>
                    <option>3 – 12 months</option>
                    <option>Over a year out</option>
                    <option>Just researching</option>
                  </select>
                </div>
              </div>

              {/* Native <details>, so this opens with JavaScript disabled — the
                  same reason the form itself posts natively. A closed field is
                  still submitted, so anything typed here and then collapsed is
                  not silently dropped. */}
              <details className="mt-6 rounded-sm border border-line bg-paper-warm px-5 py-4 [&[open]>summary]:mb-5">
                <summary className="cursor-pointer font-display text-[15px] font-bold text-brand marker:text-accent">
                  Add more detail, and we&rsquo;ll narrow it further
                </summary>

                <div className="grid gap-5 min-[560px]:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="financing">
                      Cash or financing
                    </label>
                    <select id="financing" name="financing" className={field}>
                      <option value="">Select one</option>
                      <option>Cash</option>
                      <option>Need financing</option>
                      <option>Undecided</option>
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="residency">
                      Residency interest
                    </label>
                    <select id="residency" name="residency" className={field}>
                      <option value="">Select one</option>
                      <option>Yes — residency is a goal</option>
                      <option>No — purchase only</option>
                      <option>Want to understand the options</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5">
                  <label className={label} htmlFor="area">
                    Areas you&rsquo;re considering
                  </label>
                  <select id="area" name="area" className={field}>
                    <option value="">No preference yet</option>
                    {(await listAreas()).map((a) => (
                      <option key={a.slug}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <label className={label} htmlFor="notes">
                    Anything else
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
                I agree to be contacted about my enquiry. We pass your details
                to one licensed broker and no one else.
              </label>
            </div>

            {/* Verified server-side in /api/lead before anything is saved. */}
            <Turnstile className="mt-5" />

            <button
              type="submit"
              className="mt-7 inline-flex items-center justify-center font-display text-[16px] font-bold px-7 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer"
            >
              Send my details
            </button>
          </form>

          <aside className="min-[900px]:pt-2">
            <div className="rounded-md border border-line bg-paper-warm p-6">
              <h2 className="font-display text-[17px] font-bold text-ink">
                What happens next
              </h2>
              <ol className="mt-4 space-y-4 text-[15px] leading-relaxed text-body list-decimal pl-5">
                <li>We read what you sent and rule out the areas that fit worst.</li>
                <li>
                  You get a shortlist with title status and delivery dates
                  attached.
                </li>
                <li>A licensed broker calls to talk through it.</li>
              </ol>
              <p className="mt-5 pt-5 border-t border-line text-[14px] text-muted">
                We don&rsquo;t sell your details, and we don&rsquo;t add you to
                a mailing list you didn&rsquo;t ask for.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
