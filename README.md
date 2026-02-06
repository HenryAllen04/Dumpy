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
- Serves a public timeline UI (in `web/`) intended for `history.dumpy.ai`.

## MVP architecture

1. GitHub emits `deployment_status` after Vercel deployment succeeds.
2. GitHub Action runs `dumpy capture` against `deployment_status.target_url`.
3. `dumpy publish` uploads screenshots + manifest to R2 and updates repo index.
4. `dumpy comment-pr` posts/updates a PR comment with run and timeline links.
5. Cloudflare Pages serves `web/`, which reads manifests/indexes from R2 public URLs.

## Repository structure

- `/Users/henrym5/Dumpy/src/cli.ts`: CLI entrypoint.
- `/Users/henrym5/Dumpy/src/capture.ts`: Playwright capture pipeline.
- `/Users/henrym5/Dumpy/src/discovery.ts`: route discovery + sitemap parsing.
- `/Users/henrym5/Dumpy/src/publish.ts`: R2 upload + index merge.
- `/Users/henrym5/Dumpy/src/comment-pr.ts`: PR comment upsert.
- `/Users/henrym5/Dumpy/.github/workflows/dumpy-capture.yml`: CI workflow.
- `/Users/henrym5/Dumpy/.github/workflows/deploy-landing.yml`: landing page deploy workflow.
- `/Users/henrym5/Dumpy/web/`: timeline frontend.

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
```

## Deploying the timeline UI

Deploy `/Users/henrym5/Dumpy/web` to Cloudflare Pages and set `history.dumpy.ai`.

The UI defaults to `https://assets.dumpy.ai`. You can override with query parameter:

- `?assets=https://your-assets-domain`

Examples:

- Repo timeline: `/owner/repo`
- Run detail: `/owner/repo/run/<sha>`
