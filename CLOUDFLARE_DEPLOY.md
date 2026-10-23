# Deploy full Mortal to Cloudflare Pages

Mortal is a complete frontend plus account/state backend. Its frontend lives in `public/`. Its Cloudflare backend is in `functions/api/[[path]].js` (Pages Functions), and stores data in a persistent D1 database. Do **not** set the output directory to the repository root. Do **not** enter `. as a build command.

## Step 1 — Create the D1 database
1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and select **Workers & Pages → D1 SQL Database** (it may appear as **Storage & databases → D1**).
2. Create a database named **mortal-db**.
3. Open the database’s SQL console and run the contents of [migrations/0001_init.sql](migrations/0001_init.sql). The SQL creates the `users`, `sessions`, and `states` tables.

You can instead use Wrangler to run `npx wrangler d1 execute mortal-db --remote --file=migrations/0001_init.sql` after authorizing Wrangler locally.

## Step 2 — Create a Pages project from GitHub
In **Workers & Pages → Create application → Pages → Connect to Git**, authorize the Cloudflare GitHub app to access `re-l0/mortal` and select that repository.

Configure:

| Setting | Value |
|---|---|
| Project name | mortal (or mortal-life if taken) |
| Production branch | main |
| Framework preset | None |
| Root directory | / (repo root; leave empty) |
| Build command | exit 0 |
| Build output directory | public |

**Do not choose** `cloudflare-preview`, and **do not choose** `.` as either setting. Cloudflare automatically recognizes the root `functions/` directory and bundles the API routes.

## Step 3 — Bind the database
On the Pages project, open **Settings → Bindings → Add binding → D1 database**, select **mortal-db**, set variable name **DB** (uppercase), and save. If the app is already deployed, **redeploy** so the binding is active.

### Verify
- Go to your assigned `https://<project>.pages.dev` URL. The *full app*, not the static demo, should load.
- Open `https://<project>.pages.dev/api/session`: it must respond with `{"authenticated":false}` in an incognito browser.
- Create a test account (unique email + password 10+ characters).
- Log a metric and reload; the change should persist.
- Log out and log in to verify the account still exists.
- If the API returns a DB configuration error, check the **DB** binding and redeploy. If the logs say `no such table`, apply the migration.

## Future updates
Cloudflare's Git integration automatically redeploys `main` after every push or merged pull request. GitHub Actions separately runs the scoring tests. PR branches can have preview deployments, but **main is production**.

## Important beta/security notes
- The previous Node.js server (`server.mjs`) still works locally with Node 22.5+ and an on-disk SQLite database; Cloudflare instead runs the Pages Functions API and D1.
- The two backends are separate: locally created accounts do **not** automatically migrate to Cloudflare D1. Export a local profile JSON and import it into the new cloud account through Mortal if needed. Never upload a local SQLite file to the static site or Git repository.
- This is a beta, not a security-audited production health/financial platform. Password reset, email verification, abuse/rate limits, backups, and further privacy hardening remain before real public-user launch.
- If the GitHub repository is public, the source is public. Personal user data stays in D1, not GitHub. Store no credentials or secrets in the repository.
