/* =============================================================================
   Cloudflare Turnstile — server-side verification
   =============================================================================
   The browser half lives in components/turnstile.tsx. This is the half that
   matters: a token in the request body proves nothing until Cloudflare has been
   asked about it, and siteverify is the only thing that can answer.

   Never call this from a client component. The secret is server-only and the
   verdict is not something the browser gets a say in.
   ============================================================================= */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The three outcomes the lead route has to tell apart.
 *
 *  `absent` is not a failure. The lead forms are plain HTML that submit without
 *  JavaScript, and the widget is the one part of them that cannot work with
 *  JavaScript off — so a submission with no token is a visitor we have no
 *  verdict on, not a visitor who failed one. Those fall through to the rest of
 *  the checks in lib/leads.ts rather than being turned away.
 *
 *  `unconfigured` keeps this branch deployable before TURNSTILE_SECRET exists
 *  in Netlify. It is logged loudly because it is indistinguishable, from the
 *  outside, from having no bot protection at all. */
export type TurnstileVerdict = "ok" | "absent" | "failed" | "unconfigured";

/** Reads the token the widget writes into the form.
 *  Cloudflare's field name is fixed; it is not ours to choose. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/* Fails closed. A network error, a non-2xx, a body that will not parse: all of
   them mean we could not establish that this was a person, and a token that
   was submitted but cannot be verified is the exact shape of an attack. That
   is different from no token at all, which is handled above. */
export async function verifyTurnstile(
  token: string | null,
  remoteip: string | null,
): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    console.error("TURNSTILE_SECRET is not set — lead submissions are unverified.");
    return "unconfigured";
  }
  if (!token) return "absent";

  const body = new URLSearchParams({ secret, response: token });
  // Omitted rather than sent empty: siteverify treats a blank remoteip as a
  // malformed one, and we genuinely do not have it on some requests.
  if (remoteip) body.set("remoteip", remoteip);

  let result: { success?: boolean; "error-codes"?: string[] };
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = await res.json();
  } catch (err) {
    console.error("turnstile siteverify failed —", err);
    return "failed";
  }

  if (result.success !== true) {
    // Logged with the codes because the two that matter look identical from
    // the visitor's side: `invalid-input-secret` is our misconfiguration,
    // `timeout-or-duplicate` is a token replayed or left sitting too long.
    console.error("turnstile rejected —", result["error-codes"] ?? "no codes");
    return "failed";
  }

  return "ok";
}
