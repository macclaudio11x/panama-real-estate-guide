import Script from "next/script";

/* GA4. Mounted in app/(site)/layout.tsx rather than the root layout, so it
   covers the public site and deliberately not /admin — a broker's leads inbox
   has no business sending its page paths to Google.

   The measurement ID is hardcoded rather than read from the environment. It is
   public by design (it ships in the client HTML either way), and this project
   has already lost a deploy to a NEXT_PUBLIC_* var that didn't carry over to
   the fork's Netlify site. One less thing to set.

   Route changes are not tracked here. App Router navigations don't reload the
   page, so the single gtag config below fires one page_view on first load;
   GA4's Enhanced measurement setting "Page changes based on browser history
   events" is what records the rest. That is the same approach @next/third-
   parties takes, and adding our own history listener on top would double-count
   every navigation. */

const GA_MEASUREMENT_ID = "G-2JNQK4V6T7";

export function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
