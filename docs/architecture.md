# Architecture

## Overview

`satellite-challenge` is organized as a small monorepo:

- `apps/api` ingests and normalizes realtime air and maritime data
- `apps/web` renders the operator-facing tactical display
- shared packages keep API and UI contracts aligned

## API Responsibilities

- normalize heterogeneous upstream feeds
- maintain replay-friendly entity state
- expose WebSocket and HTTP surfaces for the UI

## UI Responsibilities

- map-centric tactical display
- entity selection and detail panels
- timeline and replay controls
- UI guards that avoid leaking broken upstream payloads directly into the operator surface

## Defense Relevance

The project demonstrates how frontier-data ingestion, mapping, and operator ergonomics can be combined into a mission-style interface. Even as a prototype, it speaks to command-and-control, ISR-adjacent, and analyst-tooling patterns.
