# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack Stock Intelligence Dashboard. Users search a ticker symbol, the API fetches price history from Yahoo Finance, caches it in PostgreSQL, and returns it to a Next.js frontend with interactive candlestick/line charts.

Two independently-runnable workspaces:
- `api/` — Node.js + Fastify + TypeScript backend (port 3001)
- `frontend/` — Next.js 16 + Tailwind CSS + lightweight-charts frontend (port 3000)

## Commands

### API (`cd api/`)
```bash
npm run dev      # tsx watch — hot-reload dev server on port 3001
npm run build    # tsc compile to dist/
npm start        # run compiled dist/index.js
```

### Frontend (`cd frontend/`)
```bash
npm run dev      # Next.js dev server on port 3000
npm run build    # production build (also runs tsc type-check)
npm run lint     # eslint
```

No test suite exists yet.

## Architecture

### Data Flow
```
User types ticker → frontend POST (form) → GET /api/stocks/:ticker
  → stockService: check DB → if missing, fetch Yahoo Finance → insert DB → return rows
  → frontend renders lightweight-charts candlestick or area series
```

### API (`api/src/`)

- **`index.ts`** — Fastify server. Registers `@fastify/cors` (origin: `http://localhost:3000`) and the stock routes plugin.
- **`db/client.ts`** — Single `pg.Pool` instance exported as `db`, reads `DATABASE_URL` from `.env`.
- **`db/schema.sql`** — Two tables: `stocks` (id, ticker, name) and `price_history` (OHLCV daily rows). `UNIQUE(stock_id, date)` constraint enables `ON CONFLICT DO NOTHING` upserts.
- **`routes/stocks.ts`** — Five GET routes: `/api/stocks/:ticker` (daily), `/hourly`, `/30min`, `/15min`, `/stats`. Ticker validated with `/^[A-Za-z0-9]{1,10}(\.[A-Za-z]{1,4})?$/` — the suffix supports international exchanges (e.g. `ESLT.TA` for Tel Aviv Stock Exchange).
- **`services/stockService.ts`** — All business logic:
  - `getOrFetchStock()` — cache-on-demand: check DB, fetch Yahoo Finance if missing, insert, return.
  - `ensureFullHistory()` — called on cache hits; checks `MIN(date)`; if oldest row < 2 years old, backfills from `2000-01-01` to fill gaps from early cached fetches.
  - `fetchIntraday()` — fetches 1h/30m/15m data live (not cached in DB) for the last 59 days.
  - `getStockStats()` — calls `yahooFinance.quote()` for live metadata (market cap, 52-week range, volume, currency, exchange).
  - `normalizeExchange()` — maps `fullExchangeName` to clean labels; falls back to `exchange` code for non-US markets.

### Frontend (`frontend/src/`)

- **`app/page.tsx`** — Sole page. Owns all state: `ticker`, `dailyData`, `intradayCache`, `timeframe`, `interval`, `chartStyle`, `theme`, `stats`. Exported types (`Timeframe`, `Interval`, `ChartStyle`, `ThemeMode`, `PriceRow`) are imported by both child components.
  - Intraday data is lazy-fetched per `${ticker}:${interval}` key and memoised in `intradayCache` state to avoid redundant requests.
  - `isTfDisabled()` prevents selecting timeframes longer than the intraday data window (hour/30m/15m are capped at 1M).
- **`components/StockChart.tsx`** — `dynamic` imported (SSR disabled). Wraps lightweight-charts v5.
  - Chart is **recreated** when `data` or `chartStyle` changes (effect dep `[data, chartStyle]`).
  - Timeframe/interval changes only call `setVisibleLogicalRange()` — no recreate.
  - Theme changes use `chart.applyOptions()` — no recreate.
  - `getFromIndex()` handles YTD (walks rows to find Jan 1), ALL (returns 0), and bar-count timeframes from `BARS_FOR_WINDOW`.
  - Line mode renders `AreaSeries`; candle mode renders `CandlestickSeries`. Line color (green/red) is computed from `computeChange()` and updated via `series.applyOptions()` on timeframe change.
- **`components/StatsPanel.tsx`** — Six stat cards below the chart (Open, Last Close, Highest Close, Market Cap, 52-Week Range, Volume). Uses `Intl.NumberFormat` with the stock's native `currency` code for correct formatting (ILS for TASE stocks, etc.).

## Key Library Gotchas

### yahoo-finance2 v3
Must instantiate as a class — **not** a default import call:
```ts
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
```

### lightweight-charts v5
`addCandlestickSeries()` is removed. Use the generic `addSeries()`:
```ts
import { CandlestickSeries, AreaSeries } from 'lightweight-charts';
chart.addSeries(CandlestickSeries, { /* opts */ });
chart.addSeries(AreaSeries, { /* opts */ });
```
Intraday data requires `UTCTimestamp` (seconds since epoch), not date strings:
```ts
Math.floor(new Date(isoString).getTime() / 1000) as UTCTimestamp
```

## Environment

`api/.env`:
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/stock_intelligence
# Optional — defaults shown:
# CORS_ORIGIN=http://localhost:3000
# PORT=3001
# HOST=0.0.0.0
```

## V2 Roadmap (planned)
- **V2a** — Python microservice for RSI, MACD, Moving Averages (pandas-ta), overlaid on chart
- **V2b** — Docker Compose containerising API, Python service, PostgreSQL, Redis
- **V2c** — NewsAPI headlines → AI sentiment analysis → side panel summary
- **V2d** — scikit-learn classifier trained on indicator data → Bullish/Neutral/Bearish signal badge
