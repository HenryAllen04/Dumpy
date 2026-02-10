# Dumpy

Dumpy captures deployment screenshots and builds a long-term UI timeline for your repo.

## Repositories

- Public: [HenryAllen04/Dumpy](https://github.com/HenryAllen04/Dumpy)
- Private product: [HenryAllen04/Dumpy-Private](https://github.com/HenryAllen04/Dumpy-Private)

## What it does

- Captures route screenshots from successful deployment URLs.
- Discovers routes from `.dumpy.yml` + `sitemap.xml`.
- Stores immutable run artifacts in Cloudflare R2.
- Maintains a per-repo `index.json` timeline.
- Posts a PR comment linking to the latest run.
- Serves a public install/CTA site at `history.dumpy.ai` and an account-gated timeline dashboard route.

## MVP architecture

1. GitHub emits `deployment_status` after Vercel deployment succeeds.
2. GitHub Action runs `dumpy capture` against `deployment_status.target_url`.
3. `dumpy publish` uploads screenshots + manifest to R2 and updates repo index.
4. `dumpy comment-pr` posts/updates a PR comment with run and timeline links.
5. Cloudflare Pages serves `history-web/out` (static export): public CTA on `/`, dashboard on `/dashboard`.

## Repository structure

- `/Users/henrym5/Dumpy/src/cli.ts`: CLI entrypoint.
- `/Users/henrym5/Dumpy/src/capture.ts`: Playwright capture pipeline.
- `/Users/henrym5/Dumpy/src/discovery.ts`: route discovery + sitemap parsing.
- `/Users/henrym5/Dumpy/src/publish.ts`: R2 upload + index merge.
- `/Users/henrym5/Dumpy/src/comment-pr.ts`: PR comment upsert.
- `/Users/henrym5/Dumpy/.github/workflows/dumpy-capture.yml`: CI workflow.
- `/Users/henrym5/Dumpy/history-web/`: Next.js + shadcn timeline frontend.
- `/Users/henrym5/Dumpy/.github/workflows/deploy-landing.yml`: builds `history-web/` and deploys static export.

## Quick start

```bash
npm install
cp .dumpy.yml .dumpy.local.yml
# edit .dumpy.local.yml project.repo and routes
```

Before enabling CI, update `/Users/henrym5/Dumpy/.dumpy.yml`:

- `project.repo` must match your GitHub repo, for example `henrym5/my-app`.

Run a local capture (example):

```bash
npm run dev -- capture \
  --base-url "https://your-preview-url.vercel.app" \
  --sha "local-dev" \
  --ref "refs/heads/main" \
  --event preview \
  --config .dumpy.local.yml \
  --out output/run
```

Publish to R2:

```bash
npm run dev -- publish \
  --input output/run \
  --bucket "$R2_BUCKET" \
  --account-id "$R2_ACCOUNT_ID" \
  --access-key-id "$R2_ACCESS_KEY_ID" \
  --secret-access-key "$R2_SECRET_ACCESS_KEY" \
  --public-base-url "https://assets.dumpy.ai"
```

## End-to-end test with Dumpy-Private

Use this when the GitHub App is installed (for example on all repositories) and `app.dumpy.ai` is live.

1. Open `https://app.dumpy.ai` and sign in.
2. Click `Connect Repository` and confirm your target repository appears in the dashboard.
3. Open a PR in that repository so your deploy provider emits a successful `deployment_status` event with a preview URL.
4. In `HenryAllen04/Dumpy-Private`, trigger processing immediately:

```bash
gh workflow run "Process Capture Jobs" \
  -R HenryAllen04/Dumpy-Private \
  -f max_jobs=5
```

5. Verify in `https://app.dumpy.ai/dashboard`:
   - New webhook event is logged.
   - Capture job transitions to `completed`.
   - `manifest` link is present.
6. Verify assets in R2 (`https://assets.dumpy.ai`) and timeline pages in `history.dumpy.ai` once published.

Common failure checks:

- `APP_URL` repo variable in `HenryAllen04/Dumpy-Private` equals `https://app.dumpy.ai`.
- `GITHUB_WEBHOOK_SECRET` is present in Vercel env for Dumpy-Private.
- `JOB_RUNNER_SECRET` matches between Vercel and GitHub Actions secret.
- `R2_*` variables are set in Dumpy-Private runtime.

## Required GitHub secrets

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` (example: `https://assets.dumpy.ai`)

Optional GitHub repository variable:

- `HISTORY_APP_BASE_URL` (default: `https://history.dumpy.ai`)

Required secrets for landing deploy workflow:

- `CLOUDFLARE_API_TOKEN` (Pages edit/deploy permissions)
- `CLOUDFLARE_ACCOUNT_ID`

Optional repository variables for landing deploy workflow:

- `CF_PAGES_PROJECT` (default: `dumpy`)
- `CF_PAGES_BRANCH` (default: `main`)

## Config (`.dumpy.yml`)

Main knobs:

- `routes.include`: explicit high-value pages.
- `routes.exclude`: glob filters (`/api/*`, `/auth/*`).
- `discovery.sitemap.enabled`: append sitemap paths.
- `capture.devices`: viewport matrix.
- `discovery.maxRoutes`: cap capture cardinality.

## Development

```bash
npm run test
npm run build
npm run lint --prefix history-web
npm run build --prefix history-web
```

## Deploying the timeline UI

Deploy `/Users/henrym5/Dumpy/history-web/out` to Cloudflare Pages and set `history.dumpy.ai`.

- `/` is the public install/CTA landing page.
- `/dashboard` is account-gated in the UI.
- Sign-in target defaults to `http://localhost:edge/dashboard` in local dev and `https://app.dumpy.ai/dashboard` in production.
- Optional overrides: `NEXT_PUBLIC_DUMPY_LOCAL_ACCOUNT_DASHBOARD_URL`, `NEXT_PUBLIC_DUMPY_ACCOUNT_DASHBOARD_URL`.

The UI defaults to `https://assets.dumpy.ai`. You can override with query parameter:

- `?assets=https://your-assets-domain`

Examples:

- Repo timeline: `/owner/repo`
- Run detail: `/owner/repo/run/<sha>`
