import Script from "next/script";

/* Meta Pixel, browser side. Mounted in app/(site)/layout.tsx next to
   GoogleAnalytics, same reasoning: public site only, not /admin.

   The pixel ID is hardcoded rather than read from the environment, matching
   google-analytics.tsx — it ships in the client HTML either way, so hiding it
   behind a NEXT_PUBLIC_* var buys nothing and risks the same lost-env-var
   class of deploy bug this project has already hit once.

   This is the browser half only. lib/lead-notify.ts sends the server-side
   Conversions API event for the same pixel (env vars META_PIXEL_ID /
   META_CAPI_TOKEN) and shares its event_id with this pixel's fbq calls when
   one fires from a lead submission, so Meta dedupes the two rather than
   double-counting. That dedup only happens for events this snippet actually
   sends client-side — right now that's just PageView.

   Like the GA4 component, this does not track client-side route changes:
   fbq('track', 'PageView') fires once on first load, and App Router
   navigations don't reload the page. Meta has no automatic equivalent to
   GA4's history-based Enhanced measurement, so route-level PageViews would
   need a manual call on each navigation — not added here, matching the
   project's existing GA4 scope rather than expanding it. */

const PIXEL_ID = "2953837264947711";

export function MetaPixel() {
  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
