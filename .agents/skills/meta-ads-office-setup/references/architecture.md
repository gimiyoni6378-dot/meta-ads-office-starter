# Reference architecture

This describes the implementation pattern observed in the Agent Office Karni workflow. Adapt it to the target app rather than copying 93seconds account configuration.

## Data and authorization flow

1. A signed-in user connects Meta through OAuth using the app's own Meta developer app and HTTPS callback.
2. The server stores the Meta token encrypted in Supabase, scoped to the authenticated user. Browser code receives neither the token nor the Supabase service-role key.
3. Server routes call Meta Ads MCP with that user's token. Account and Page lists are fetched from Meta when needed; do not hardcode their display names or identifiers.
4. The user uploads creative and enters campaign, ad-set, audience, schedule, objective, URL, and budget details. The server validates the brief and stores it in a private Supabase table and private asset bucket.
5. A review step presents the full intended configuration. Approved draft preparation writes one Meta object at a time, saving returned IDs and progress to the database so interrupted requests can be reconciled.
6. Preview requests use the stored creative/ad IDs and Meta's preview operation. Render only validated Meta HTTPS preview URLs and provide a direct Meta link when embedding is blocked.
7. Performance reporting is read-only and should clearly distinguish live Meta results from app-archived snapshots.

## Safe draft and preview mode

For a preview-only product, use a separate server operation that stops before any activation call. Repeated requests should not publish or activate entities. Preserve the paused/unpublished status, verify it by reading entities back from Meta, and show a warning if Meta cannot confirm the state.

Activation is a different product action. If implemented, it needs a separate explicit user authorization at the moment of publishing, tied to the selected account, approved spend, schedule, and entities. A previous approval to save a draft does not authorize delivery.

## Per-operator setup

Each organization must provide its own:

- Meta developer app, OAuth redirect allowlist, required permissions, and any applicable review/verification approvals.
- Vercel or equivalent HTTPS server deployment.
- Supabase project, Auth users/allowlist, private database tables, and private creative storage.
- Runtime secrets for Meta OAuth, Supabase server access, encryption, and the approved site origin.
- Page, ad-account, pixel, and business assets that the signed-in operator is permitted to use.

Use `.env.example` with blank or obvious placeholder values. Never ship real credentials or another customer's IDs in a template.

## Known limits in the source implementation

- Meta app mode, business verification, permission review, account restrictions, and billing can block draft creation independently of the code.
- Preview is available only after Meta has created the creative/ad and returned a supported preview URL.
- A successful create response is not evidence that an ad is approved, scheduled, or delivering.
- Meta may normalize or preserve targeting fields. Read back the saved entity and inspect Ads Manager when an error persists; do not blindly retry a mutation.
