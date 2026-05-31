---
name: project-stock-intel
description: Stock Intelligence Dashboard — full-stack project scaffold status and architecture
metadata:
  type: project
---

Full-stack stock dashboard. Backend (Fastify + PostgreSQL) and frontend (Next.js 15 + Tailwind 4 + lightweight-charts 5) are both scaffolded and type-check clean.

**Why:** CS year-three LLM course project. Building incrementally — backend first, then frontend.

**How to apply:** When adding features, follow the cache-on-demand pattern (daily bars cached in PG, intraday always live). Check V2 roadmap (technical indicators, Docker, AI news sentiment, ML signal) for what comes next.

**Current state (2026-05-18):** V1 complete — all files written, deps installed, 11 unit tests passing, tsc --noEmit clean on both workspaces. User still needs to: create .env file, create the DB, apply schema.sql, then run both dev servers.

**Key file locations:**
- api/src/services/stockService.ts — all business logic + ServiceError
- api/src/services/newsUtils.ts — pure helpers (unit-tested)
- api/src/routes/stocks.ts — all HTTP routes
- frontend/src/app/page.tsx — root state owner + exported shared types
- frontend/src/components/StockChart.tsx — lightweight-charts wrapper (dynamic SSR=false)
- frontend/src/utils/chartUtils.ts — BARS_FOR_WINDOW, getFromIndex, computeChange
- frontend/src/utils/statsUtils.ts — price(), compactVol()
