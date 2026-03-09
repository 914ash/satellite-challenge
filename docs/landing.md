# Satellite Challenge Walkthrough

Satellite Challenge is easiest to understand from the screen first: it is a live tracking dashboard with replay and entity review, not just a map demo.

## Screenshot Walkthrough

![Satellite dashboard](../satellite-challenge-screenshot-1.png)
The dashboard view shows the main job of the app: watch traffic, switch between entities, and keep the map readable while the feed stays busy.

![Satellite map](../satellite-challenge-screenshot-2.png)
The map view shows the value of the project. Tracks stay in geographic context, and the side panel keeps the details close without swallowing the map.

## What To Review

1. Start with [README.md](../README.md) for the short version.
2. Inspect `apps/api` if you want the ingest and replay path.
3. Inspect `apps/web` if you want the map interactions and operator flow.
4. Read [architecture.md](architecture.md) if you want the system layout after that.

## Notes

This repo is the public version of a larger challenge project. The point of the cleanup was simple: keep the version worth reviewing and cut the rest.
