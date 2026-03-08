# Satellite Challenge

![Satellite Challenge cover](assets/covers/cover.svg)

Maritime and air tracking dashboard for realtime geospatial awareness, replay, and operator review.

![Satellite Challenge dashboard](visual-walkthrough-dashboard.png)
![Satellite Challenge map](artifacts/map-default.png)

See [docs/landing.md](docs/landing.md) for the full landing page, screenshot walkthrough, and repo evaluation guide.

This is the canonical public version of a larger challenge cluster that went through several iterations. The public repo keeps the strongest implementation path and moves earlier attempts, scratch work, and secret-bearing files out of the publication path.

## Why It Fits This Portfolio

- combines geospatial reasoning with realtime entity tracking
- reflects defense-adjacent operator workflows rather than generic dashboards
- demonstrates iteration under challenge constraints and convergence on a publishable architecture

## Why This Repo Exists

This repo turns a challenge-style build into something a reviewer can actually evaluate: a clear tactical UI, a defined API/UI split, and a public-safe version of the strongest implementation path instead of a bundle of half-finished variants.

## Project Structure

- `apps/api`: Express API, feed aggregation, replay buffer, normalization, enrichment
- `apps/web`: React tactical UI, map surface, side panels, replay controls
- `packages/shared-types`: shared contracts between API and UI

## Environment

Copy `.env.example` to `.env` and fill in only the providers you intend to use:

- `MAPBOX_ACCESS_TOKEN`
- `AISSTREAM_API_KEY`
- `FLIGHTAWARE_API_KEY`
- optional `OPENSKY_USERNAME`
- optional `OPENSKY_PASSWORD`

## Run

```bash
npm install
npm run dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

## Test

```bash
npm test
npm run test:e2e -w @sat/web
```

## Publication Safety

- tracked secrets were removed from the public path
- `.env` is ignored and replaced with `.env.example`
- superseded challenge variants were moved to quarantine

See [docs/landing.md](docs/landing.md), [docs/architecture.md](docs/architecture.md), and [docs/publishing-notes.md](docs/publishing-notes.md).
