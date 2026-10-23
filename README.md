# Mortal — Your life as an RPG

**Mortal is the full application, not a static preview.** It includes the interactive dashboard, 10 life areas, personalized scoring, category analytics, quests, XP, achievements, account onboarding, activity logs and persistence.

- **Web app:** `public/` — frontend UI, PWA assets, original Mortal skull icon, scoring engine
- **Cloudflare backend:** `functions/api/[[path]].js` — account, session, and state APIs backed by **D1**
- **Database schema:** `migrations/0001_init.sql`
- **Local Node backend:** `server.mjs` — maintains compatibility with locally hosted beta accounts and SQLite
- **Tests:** `tests/` — scoring checks and deployment checks

## Deploy the FULL application on Cloudflare Pages

**[Follow CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)**. The Cloudflare Git deployment settings are:

| Setting | Value |
|---|---|
| GitHub repository | `re-l0/mortal` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Output directory | `public` |
| Root directory | Repository root |

Create a D1 database named `mortal-db`, execute the SQL migration, then bind it in Cloudflare Pages under variable name **DB** and redeploy. Once GitHub integration is active, commits merged into main deploy automatically.

**Do not use `.` as a build command or output directory.** It is not a build command, and publishing the repository root could expose internal source, migrations and configuration files. Cloudflare Pages automatically loads the root `functions/` directory for API endpoints.

## Local development

Node.js 22.5+ is required for the local server (built-in SQLite). Run:

`npm start`

Then open `http://localhost:3000`. Run `npm test` for scoring checks.

## Data and security

- New Cloudflare accounts live in D1 and are separate from any locally hosted SQLite accounts. Export/import JSON in the app to migrate profile data manually.
- Personal data and passwords must never be committed to the GitHub repository; `.gitignore` excludes local databases and secrets.
- This remains a beta. Before a broad public-user launch, add rate limiting, password recovery, email verification, backups, monitoring, and independent security review. Sensitive health/finance information should not be entered until production safeguards are established.
