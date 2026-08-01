# Netlify Functions

Serverless endpoints left over from v1.

`lead-submit.mjs` was removed on 2026-08-01. Lead capture now lives in the v2 app at
`v2/app/api/lead/route.ts`, which owns the lead in Supabase instead of forwarding it to
the DO Panama CRM. Nothing on the live site called `/api/lead-submit` by then: the v1
landing pages that used it stopped being published at the v2 cutover and now 404.

## `calendly-webhook.mjs` → `POST /api/calendly-webhook`

Receives Calendly server-side webhooks (`invitee.created`). The function:

1. Verifies HMAC-SHA256 signature against `CALENDLY_WEBHOOK_SIGNING_KEY`
2. Pushes the lead to the CRM with `tag="Hot Lead - Calendly"` + meeting time in `next_action_date`
3. Fires Meta CAPI `Schedule` event ($200, deduped with browser Pixel via shared `event_id`)

Subscribe via Calendly API:
```bash
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer $CALENDLY_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://panamarealestateguide.com/api/calendly-webhook",
    "events": ["invitee.created", "invitee.canceled"],
    "user": "https://api.calendly.com/users/c09ad360-055d-484e-8bf8-b761b1aacfbc",
    "scope": "user",
    "signing_key": "<random-hex>"
  }'
```

## Required env vars / GitHub Secrets

| Name | Purpose | Used by |
|------|---------|---------|
| `CRM_API_URL` | CRM POST clients endpoint | calendly-webhook only |
| `CRM_API_KEY` | Matches `OPENCLAW_API_KEY` in CRM Netlify env | calendly-webhook only |
| `META_PIXEL_ID` | Already configured | calendly-webhook; also read by v2 `/api/lead` |
| `META_CAPI_TOKEN` | Already configured | calendly-webhook; also read by v2 `/api/lead` |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Random hex string used for HMAC verify | calendly-webhook only |

Set these in Netlify UI → Site settings → Environment variables, OR the deploy
workflow can pass them through from GitHub Secrets if we wire that up.
