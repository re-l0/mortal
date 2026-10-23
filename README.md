# Mortal — Life as an RPG

Mortal turns goals, habits, and daily activities into a personalized life-progression experience.

## Cloudflare Pages preview

This repository currently contains the **Mortal Beta 1.1 interactive demo** for static hosting. It uses fictional demonstration information and is separate from production account data.

To deploy with [Cloudflare Pages](https://dash.cloudflare.com/):
1. Open **Workers & Pages → Create application → Pages → Connect to Git**.
2. Authorize GitHub if Cloudflare requests access, and select `re-l0/mortal`.
3. Select production branch `main`.
4. Select **None** as framework, build command `exit 0` and output directory `cloudflare-preview`.
5. Deploy. Changes merged to `main` will trigger future deployments.

**Important:** The static preview does not host the Node.js/SQLite server, authentication API, or production data. The full application needs a Cloudflare-compatible backend and durable persistence (for example Workers + D1) before a real-user launch.

## Source workflow

Use pull requests for changes, preview them on Cloudflare, and merge reviewed changes to `main` for production deployment.

## Privacy

The repository was reported by GitHub as **public** when first checked on October 23, 2026. Do not add sensitive profiles, secrets, `.env` files, or SQLite databases.
