---
name: meta-ads-office-setup
description: Set up or adapt a Meta Ads workflow in a code repository, including Meta OAuth, server-side token storage, Supabase/Vercel configuration, performance reporting, ad intake, paused drafts, and Meta previews.
---

# Meta Ads Office setup

Help the user adapt the Meta Ads Office workflow to the current repository and their own business accounts. Treat this skill as implementation guidance; it is not a Meta connector and does not grant account access.

## Workflow

1. Inspect the repository, current deployment target, authentication, database, and any existing Meta integration before proposing changes. Reuse the project's existing stack when practical.
2. Read [references/architecture.md](references/architecture.md) for the proven flow and important boundaries.
3. Separate universal code from each operator's configuration. Keep business names, page and ad-account IDs, GA properties, domains, user allowlists, and OAuth credentials in runtime configuration or an owner-managed database, not in reusable source defaults.
4. Implement in small, reviewable changes. Keep Meta access tokens server-side and encrypted at rest. Never put app secrets, service-role keys, OAuth tokens, or login codes in browser code, committed files, logs, or chat.
5. Use the narrowest Meta permissions and available MCP operations needed by the requested workflow. Explain when Meta app review, business verification, advanced access, redirect URI registration, or account ownership is required; do not claim a pending review is approved.
6. Keep reporting reads separate from campaign mutations. Build a clear user review step before creating Meta campaign objects. The draft/preview operation must stop before activation; activation is a separate action requiring explicit approval of the account, budget, schedule, and final entities.
7. Before creating or changing campaigns, ad sets, ads, budgets, schedules, audiences, or creatives, show the exact account and proposed changes. Follow the user's approval boundary. Publishing and spend require explicit authorization of the final budget, schedule, and enabled status.
8. Verify code paths with mocks or local checks when appropriate. Never run a live Meta write as a test. After deployment, report exactly what was deployed and what still requires the user's Meta-side action.

## Expected user experience

- The user can connect/disconnect their own Meta account with OAuth.
- The app shows available ad accounts and Pages returned by Meta, with a deliberate refresh action for renamed assets.
- The user supplies a creative and settings, reviews a readable summary, and can cancel/reset before submission.
- The app can create an unpublished/paused draft and show Meta's actual placement previews when the API returns them. Do not synthesize a fake preview or equate a saved draft with delivery.
- Reports read live or stored account metrics and state their source and date window.

## Boundaries

- Do not reuse the original 93seconds Meta app, credentials, database, pixel, ad account, Page, user allowlist, or campaign data for another business.
- Do not ask the user to paste secrets into chat. Direct them to the deployment provider's secret environment settings.
- Do not enable delivery, change a live budget, broaden permissions, submit an app for review, or modify a Page without the user's explicit authorization for that action.
- If a Meta response is ambiguous or a write outcome is unknown, read the existing entity state before retrying to avoid duplicate campaigns or spend.
