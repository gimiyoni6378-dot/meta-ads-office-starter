# Deployment setup

## 1. Deploy the app

Import this `app-template` directory as the Vercel project root. Add the variables from `.env.example` to Vercel Project Settings → Environment Variables. Keep `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`, and `META_TOKEN_ENCRYPTION_KEY` server-only. Set `META_REDIRECT_URI` to the deployed URL plus `/api/meta/callback`.

To generate the encryption key locally, use Node.js:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 2. Configure Supabase

Run `supabase/migrations/0001_meta_ads_office.sql` in the new Supabase project's SQL editor. In Supabase Auth, configure the deployed site URL and redirect URLs. Invite only the account owner and add the same email to `DASHBOARD_ALLOWED_EMAILS` in Vercel. The user signs in with the password set in Supabase Auth.

## 3. Configure Meta OAuth

Create or select the business's own Meta developer app. Add the deployed callback URL from `META_REDIRECT_URI` to the app's valid OAuth redirect URI allowlist. Configure the login settings and app mode, then request only the permissions required for the chosen MCP tools. The exact permissions and business verification/app review requirements depend on Meta's current app configuration and whether the app is used by people outside its developer/test roles.

Set the app ID and secret in Vercel. If the app requires a Login Configuration ID, set `META_LOGIN_CONFIG_ID`. Redeploy after environment changes. Then open the deployed app, sign in, click **Meta 광고 연결**, and select an accessible ad account.

## 4. Use

- **성과 보고서** reads campaign and account metrics from Meta Ads MCP. A report refresh stores the last seven complete days in this Supabase project for later display.
- **소재 전달 · 광고 설정** accepts an image and the requested ad settings.
- **초안만 만들기 · 미게재** creates paused/unpublished Meta objects and stops before activation.
- **미리보기** requests Meta's actual preview for the saved draft. A preview does not publish the ad.
- The separate **광고 게재** action can activate a campaign. Review account, creative, budget, and schedule before using it; actual delivery may incur spend.

## 5. Troubleshooting notes

- A missing account or Page is usually a Meta permission, business assignment, or app-mode issue. Refresh the Page list from the form after changing Meta access.
- If OAuth reports a blocked redirect URL, compare the deployed callback URL character for character with both `META_REDIRECT_URI` and Meta's allowlist.
- Tokens and ad data are scoped to the Supabase project and user account configured by the operator. This starter kit does not connect to the original Agent Office database.
