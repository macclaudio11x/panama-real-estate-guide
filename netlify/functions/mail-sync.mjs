/* =============================================================================
   mail-sync — the cron that keeps the CRM's inbox current
   =============================================================================
   Deliberately thin. It holds no IMAP logic and no database credentials; it
   authenticates to /api/mail/sync and reports what came back. The work lives in
   the Next app (v2/lib/mail.ts) because that is where the Supabase client, the
   types and the rest of the CRM already are, and a second copy of mailbox
   handling in a different runtime is a second thing to get wrong.

   Every five minutes: roughly 8,600 invocations a month, against a 125,000
   free-tier allowance. A reply that lands while somebody is on the phone shows
   up before the call ends, which is the point.
   ============================================================================= */

export default async function handler() {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    // Nothing to retry against — a missing variable is a deploy problem, not a
    // transient one, so say which and stop.
    console.error(
      `mail-sync not configured: ${!base ? "URL" : ""}${!base && !secret ? " and " : ""}${!secret ? "CRON_SECRET" : ""} missing.`,
    );
    return new Response("Not configured", { status: 500 });
  }

  const started = Date.now();

  try {
    const res = await fetch(`${base}/api/mail/sync`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    const ms = Date.now() - started;

    if (!res.ok) {
      console.error(`mail-sync failed (${res.status}) after ${ms}ms:`, body.error ?? body);
      return new Response("Sync failed", { status: 502 });
    }

    // Logged on every run, including the quiet ones: a log that only appears
    // when mail arrives is indistinguishable from a cron that stopped firing.
    console.log(
      `mail-sync ok in ${ms}ms — fetched ${body.fetched ?? 0}, matched ${body.matched ?? 0}, ` +
        `unmatched ${body.unmatched ?? 0}, skipped ${body.skipped ?? 0}`,
    );
    return new Response("OK");
  } catch (e) {
    console.error("mail-sync could not reach the app:", e?.message ?? e);
    return new Response("Unreachable", { status: 502 });
  }
}

export const config = {
  schedule: "*/5 * * * *",
};
