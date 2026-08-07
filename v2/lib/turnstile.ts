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

/** The four outcomes the lead route has to tell apart.
 *
 *  `absent` USED TO BE LET THROUGH, on the grounds that the lead forms are
 *  plain HTML that submit with JavaScript off and the widget is the one part
 *  of them that cannot. That reasoning was sound and the hole it left was
 *  immediately load-bearing: anything posting straight to /api/lead sends no
 *  token either, so the exception written for people without JavaScript was
 *  used, in practice, only by bots. Eight of the first thirteen rows in the
 *  table arrived that way, including a run that fills every field plausibly
 *  and trips no heuristic.
 *
 *  So it is now a rejection. The cost is real and worth naming: a visitor with
 *  JavaScript genuinely disabled can no longer submit these forms at all.
 *
 *  `unconfigured` still passes, and deliberately. If TURNSTILE_SECRET goes
 *  missing, rejecting `absent` would mean rejecting every submission on the
 *  site — a config slip would silently cost every lead rather than let some
 *  spam through. It is logged loudly because from the outside it is
 *  indistinguishable from having no bot protection at all. */
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
