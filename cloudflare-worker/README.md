# Emilia Manarion API Worker

This Cloudflare Worker provides the browser-safe API used by the static GitHub Pages calculator. It forwards only these public, read-only Manarion routes:

- `GET /players/:username`
- `GET /market`
- `GET /guilds`

It is deliberately not a general-purpose proxy. Browser access is limited to `https://velhosi.github.io` and local `localhost` / `127.0.0.1` previews. Responses are marked `no-store` so the calculator receives current Manarion data.

## Deploy

The live Worker is `https://emilia-manarion-api.emilia-manarion-api.workers.dev`, and that address is already configured in the calculator. To test and redeploy it, run these commands from this directory:

```sh
npm install
npm test
npx wrangler login # only needed for the first deployment or a different Cloudflare account
npm run deploy
```

If the GitHub Pages account or domain changes, update `SITE_ORIGINS` in `src/index.js` before redeploying.

The website remains a build-free static site. Wrangler is only used to test and deploy this separate Worker.
