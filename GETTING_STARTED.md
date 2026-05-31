# Stock Intelligence Dashboard — Project Reference

A full-stack web application for exploring stock price history. Search any US ticker, view
interactive candlestick or area charts with volume, read live stats, and browse the latest
news headlines — all backed by a PostgreSQL cache so repeat lookups are near-instant.

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites & First-Time Setup](#3-prerequisites--first-time-setup)
4. [Project Structure](#4-project-structure)
5. [Running the App](#5-running-the-app)
6. [Environment Variables](#6-environment-variables)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Architecture & Data Flow](#9-architecture--data-flow)
10. [Frontend Component Map](#10-frontend-component-map)
11. [Key Library Gotchas](#11-key-library-gotchas)
12. [Known Limitations](#12-known-limitations)
13. [V2 Roadmap](#13-v2-roadmap)

---

## 1. What It Does

**Search** — type a ticker (e.g. `AAPL`) into the search bar. The autocomplete dropdown
suggests matches from Twelve Data in real time. Selecting one triggers a full data fetch.

**Chart** — price history renders as an interactive candlestick or area chart built on
`lightweight-charts`. A volume histogram sits beneath the price series. A floating crosshair
tooltip shows OHLCV values as you hover.

**Timeframes** — switch between 1D / 5D / 1M / 3M / 6M / YTD / 1Y / All on any interval.

**Intervals** — Day (daily bars), 1h, 30m, 15m. Intraday data is fetched live and cached
in-memory for the session; only the last 59 days are available.

**Stats panel** — five cards below the chart: Open, Last Close, Highest Close, 52-Week Range,
Total Volume. Currency auto-adapts to the stock's native currency (e.g. ILS for TASE stocks).

**News** — latest headlines fetched from NewsAPI, filtered for relevance to the ticker.
Displayed as a card grid with thumbnails, publisher, and relative timestamp.

**Theme** — full dark / light mode toggle; every component is theme-aware.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Backend language | TypeScript | 6.x | Compiled with `tsc`, hot-reloaded with `tsx watch` |
| Backend framework | Fastify | 5.x | Faster than Express, built-in logger, schema validation |
| Database | PostgreSQL | 14+ | Price history cache; `pg` driver (`Pool`) |
| Stock data | Twelve Data REST API | — | Free plan: 800 req/day, 8 req/min |
| News data | NewsAPI REST API | — | Free plan: 100 req/day, last 30 days only |
| Frontend framework | Next.js | 16.x | App Router, Turbopack dev server |
| Styling | Tailwind CSS | 4.x | Utility-first; no config file needed in v4 |
| Charting | lightweight-charts | 5.x | TradingView's open-source chart library |
| Runtime | Node.js | 20 LTS | Both workspaces |
| Test runner | Vitest | 4.x | Unit tests for pure utility functions |

---

## 3. Prerequisites & First-Time Setup

### 3.1 Install tools

| Tool | Where to get it |
|---|---|
| Node.js 20 LTS | https://nodejs.org (Windows installer) |
| PostgreSQL 14+ | https://www.postgresql.org/download/windows |
| Git | https://git-scm.com/download/win |
| VS Code | https://code.visualstudio.com |

During PostgreSQL installation, set a password for the `postgres` superuser and keep the
default port `5432`. Write the password down — you'll need it for `.env`.

### 3.2 Create the database

Open pgAdmin or the psql shell and run:

```sql
CREATE DATABASE stock_intelligence;
```

Then apply the schema (from the project root):

```bash
psql -U postgres -d stock_intelligence -f api/src/db/schema.sql
```

Or paste the contents of `api/src/db/schema.sql` into pgAdmin's Query Tool and run it.

### 3.3 Get API keys

| Service | Free tier | Sign up |
|---|---|---|
| Twelve Data | 800 req/day, 8 req/min | https://twelvedata.com |
| NewsAPI | 100 req/day, last 30 days | https://newsapi.org |

### 3.4 Install dependencies

```bash
cd api      && npm install && cd ..
cd frontend && npm install && cd ..
```

### 3.5 Create `api/.env`

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/stock_intelligence
TWELVE_DATA_API_KEY=your_key_here
NEWS_API_KEY=your_key_here
PORT=3001
# Optional:
# CORS_ORIGIN=http://localhost:3000
# HOST=0.0.0.0
```

---

## 4. Project Structure

```
stock_market_pred/
│
├── api/                                ← Node.js / Fastify backend (port 3001)
│   └── src/
│       ├── index.ts                    ← Server entry: registers CORS + routes, starts Fastify
│       ├── db/
│       │   ├── client.ts               ← Single pg.Pool instance exported as `db`
│       │   └── schema.sql              ← DDL for `stocks` and `price_history` tables
│       ├── routes/
│       │   └── stocks.ts               ← All HTTP routes; tickerRoute() wraps error handling
│       └── services/
│           ├── stockService.ts         ← All business logic + ServiceError class
│           └── newsUtils.ts            ← Pure helpers: buildFilterTerms, filterRelevantNews
│
├── frontend/                           ← Next.js 16 frontend (port 3000)
│   └── src/
│       ├── app/
│       │   └── page.tsx                ← Sole page; owns all state; exports shared types
│       ├── components/
│       │   ├── StockChart.tsx          ← lightweight-charts wrapper (dynamic, SSR disabled)
│       │   ├── StatsPanel.tsx          ← Five stat cards below the chart
│       │   ├── TickerAutocomplete.tsx  ← Debounced search dropdown
│       │   ├── NewsSection.tsx         ← News card grid with skeleton loading
│       │   └── StockLoader.tsx         ← Animated candlestick spinner
│       └── utils/
│           ├── chartUtils.ts           ← getFromIndex, computeChange, toTimestamp, isIntraday
│           └── statsUtils.ts           ← price(), compactVol() formatters
│
├── CLAUDE.md                           ← AI assistant instructions (checked in)
└── GETTING_STARTED.md                  ← This file
```

---

## 5. Running the App

Two terminals, run simultaneously:

```bash
# Terminal 1 — API (hot-reload)
cd api
npm run dev
# → Server listening at http://0.0.0.0:3001

# Terminal 2 — Frontend (Turbopack)
cd frontend
npm run dev
# → Ready at http://localhost:3000
```

Other commands:

```bash
# Type-check without emitting
cd api      && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Lint frontend
cd frontend && npm run lint

# Production build
cd api      && npm run build   # emits to api/dist/
cd frontend && npm run build   # Next.js optimised build

# Unit tests
cd api      && npm test
cd frontend && npm test
```

---

## 6. Environment Variables

All variables live in `api/.env`. The frontend reads one optional variable:

| Variable | Where | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `api/.env` | Yes | Full PostgreSQL connection string |
| `TWELVE_DATA_API_KEY` | `api/.env` | Yes | Twelve Data key (free plan OK) |
| `NEWS_API_KEY` | `api/.env` | Yes | NewsAPI key (free developer plan OK) |
| `PORT` | `api/.env` | No | API port (default: `3001`) |
| `HOST` | `api/.env` | No | Bind address (default: `0.0.0.0`) |
| `CORS_ORIGIN` | `api/.env` | No | Allowed origin (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | No | API base URL seen by the browser (default: `http://localhost:3001`) |

---

## 7. Database Schema

```sql
-- One row per ticker we have data for
CREATE TABLE stocks (
    id         SERIAL PRIMARY KEY,
    ticker     VARCHAR(10)  NOT NULL UNIQUE,
    name       VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Daily OHLCV bars
CREATE TABLE price_history (
    id       SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    date     DATE NOT NULL,
    open     DECIMAL(12, 4),
    high     DECIMAL(12, 4),
    low      DECIMAL(12, 4),
    close    DECIMAL(12, 4),
    volume   BIGINT,
    UNIQUE(stock_id, date)     -- enables ON CONFLICT DO NOTHING upserts
);

CREATE INDEX idx_price_history_stock_date
    ON price_history(stock_id, date DESC);
```

**Cache-on-demand pattern:** the first request for any ticker costs two Twelve Data calls
(up to two batches of 5 000 bars going back to 2000-01-01). Every subsequent request is served
from PostgreSQL. `ensureFullHistory()` checks on each cache hit whether a backfill to
2000-01-01 is still outstanding, and fills the gap if needed.

---

## 8. API Reference

Base URL: `http://localhost:3001`

### Ticker validation

All `:ticker` params must match `/^[A-Za-z0-9]{1,10}(\.[A-Za-z]{1,4})?$/`.
Dot-suffix format is used for international exchanges (e.g. `ESLT.TA`).

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stocks/search?q=<query>` | Autocomplete — returns up to 8 matching tickers |
| `GET` | `/api/stocks/:ticker` | Daily OHLCV history from 2000-01-01 to today |
| `GET` | `/api/stocks/:ticker/hourly` | 1-hour bars for the last 59 days (live, not cached) |
| `GET` | `/api/stocks/:ticker/30min` | 30-minute bars for the last 59 days |
| `GET` | `/api/stocks/:ticker/15min` | 15-minute bars for the last 59 days |
| `GET` | `/api/stocks/:ticker/stats` | Live quote metadata (name, exchange, currency, 52-wk range, volume) |
| `GET` | `/api/stocks/:ticker/news` | Up to 10 filtered recent headlines from NewsAPI |

### Response shapes

**`/search`** → `Suggestion[]`
```json
[{ "ticker": "AAPL", "name": "Apple Inc", "exchange": "NASDAQ", "type": "Common Stock" }]
```

**`/api/stocks/:ticker`** → `PriceRow[]`
```json
[{ "date": "2024-01-02", "open": 185.00, "high": 187.50, "low": 184.20, "close": 186.80, "volume": 82345678 }]
```

**`/stats`** → `StockStats`
```json
{
  "name": "Apple Inc",
  "exchangeName": "Nasdaq",
  "currency": "USD",
  "marketCap": null,
  "fiftyTwoWeekHigh": 220.20,
  "fiftyTwoWeekLow": 164.08,
  "volume": 58234100
}
```
> `marketCap` is always `null` — not available on the Twelve Data free plan.

**Error shape** → `{ "error": "<message>" }` with an appropriate HTTP status code:
- `400` — invalid ticker format or bad query parameter
- `404` — ticker not found / not supported by Twelve Data
- `500` — unexpected server error (details logged server-side, not forwarded to client)
- `502` — NewsAPI upstream error
- `503` — news service not configured (missing `NEWS_API_KEY`)

---

## 9. Architecture & Data Flow

### Daily price fetch (first request for a ticker)

```
User searches "AAPL"
  → GET /api/stocks/AAPL
    → stockService.getOrFetchStock("AAPL")
      → SELECT id FROM stocks WHERE ticker = 'AAPL'  -- not found
      → tdFetch /time_series (batch 1, up to 5 000 bars from 2000-01-01)
      → if batch 1 = 5 000 bars → tdFetch /time_series (batch 2 to fill the gap)
      → tdFetch /quote  -- best-effort company name
      → INSERT INTO stocks (ticker, name)
      → INSERT INTO price_history ... ON CONFLICT DO NOTHING
      → SELECT date, open, high, low, close, volume ORDER BY date ASC
  ← JSON array of PriceRow
```

### Daily price fetch (cached)

```
  → SELECT id FROM stocks WHERE ticker = 'AAPL'  -- found
  → ensureFullHistory(): SELECT MIN(date)
      if MIN(date) > 2 years ago → backfill from 2000-01-01
  → SELECT price_history ORDER BY date ASC
  ← JSON array (from DB, no Twelve Data call)
```

### Intraday fetch (always live)

```
  → tdFetch /time_series with interval=1h/30min/15min, last 59 days
  ← JSON array (not stored in DB, memoised in React state per session)
```

### News fetch

```
  → tdFetch /quote  -- best-effort company name (for richer search query)
  → buildFilterTerms(ticker, companyName)  -- e.g. ["AAPL", "APPLE"]
  → extractSearchQuery(companyName)        -- e.g. "Apple"
  → fetch NewsAPI /everything?q=AAPL OR "Apple"
  → filterRelevantNews(pool, filterTerms, minRelevant=3)
      if < 3 titles match filter → fall back to full NewsAPI result
  ← up to 10 articles
```

### International tickers (dot → colon conversion)

Twelve Data uses colon-separated exchange suffixes, not dot. `toTDSymbol()` converts:

| Input | Sent to Twelve Data |
|---|---|
| `AAPL` | `AAPL` |
| `ESLT.TA` | `ESLT:TASE` |
| `MSFT.L` | `MSFT:LSE` |

The autocomplete search filters out colon-format symbols returned by Twelve Data's search API,
so only dot-compatible tickers are suggested.

---

## 10. Frontend Component Map

### `app/page.tsx` — root state owner

Owns all application state and acts as the orchestrator. Key state:

| State | Type | Purpose |
|---|---|---|
| `ticker` | `string` | Controlled input value |
| `activeTicker` | `string` | Ticker of the currently displayed stock |
| `dailyData` | `PriceRow[]` | Daily bars served from the DB |
| `intradayCache` | `{ [key]: PriceRow[] }` | In-memory cache keyed by `"TICKER:interval"` |
| `stats` | `LiveStats \| null` | Live quote metadata |
| `news` | `NewsArticle[]` | News articles |
| `newsError` | `string \| null` | Set when the news endpoint itself fails |
| `timeframe` | `Timeframe` | Chart window (1D … ALL) |
| `interval` | `Interval` | Candle size (day, hour, 30m, 15m) |
| `chartStyle` | `ChartStyle` | `'candle'` or `'line'` |
| `theme` | `ThemeMode` | `'dark'` or `'light'` |

Exported types used by child components: `PriceRow`, `Timeframe`, `Interval`, `ChartStyle`,
`ThemeMode`.

`isTfDisabled(tf, iv)` prevents selecting timeframes longer than the intraday window
(intraday intervals cap at 1M).

---

### `components/StockChart.tsx`

`dynamic` imported with `ssr: false` (lightweight-charts requires a DOM).

**Three effects, three responsibilities:**

| Effect deps | What it does |
|---|---|
| `[data, chartStyle]` | Destroys and recreates the chart, sets all series data, subscribes crosshair |
| `[timeframe, interval, data.length, chartStyle]` | Calls `setVisibleLogicalRange()` — no chart recreate |
| `[theme]` | Calls `chart.applyOptions()` and updates tooltip CSS — no chart recreate |

Time keys: daily bars use date strings (`"2024-01-02"`); intraday bars use `UTCTimestamp`
(seconds since Unix epoch) via `toTimestamp(isoString)`.

---

### `components/TickerAutocomplete.tsx`

Debounced search (150 ms) with keyboard navigation. Key behaviours:

- **`justPickedRef`** — set `true` in `pick()` before calling `onChange(ticker)`, cleared on
  the next real user keystroke. Prevents the `value`-change effect from re-fetching and
  reopening the dropdown immediately after a selection.
- **Enter key** — if a suggestion is highlighted, selects it; otherwise closes the dropdown
  and lets the form submit normally.
- **Blur delay** — `setTimeout(() => setOpen(false), 150)` so a mousedown on a suggestion
  fires before the blur handler dismisses the list.

---

### `components/StatsPanel.tsx`

Five stat cards in a responsive grid (`grid-cols-3 md:grid-cols-5`):
Open · Last Close · Highest Close · 52-Week Range · Total Volume.

Currency formatting uses `Intl.NumberFormat` with the stock's native `currency` field from the
stats endpoint — so Israeli stocks show ILS, UK stocks show GBP, etc.

---

### `components/NewsSection.tsx`

Card grid (1 → 2 → 3 → 4 columns on progressively wider screens). Shows:
- Skeleton loading animation while `loading=true`
- `"News unavailable — <reason>"` when the API itself fails (`error` prop)
- `"No recent news found"` when the API succeeds but returns 0 articles
- Article cards with image, title (3-line clamp), publisher, and relative time

---

### `utils/chartUtils.ts`

| Export | Description |
|---|---|
| `BARS_FOR_WINDOW` | Maps `Interval × Timeframe` → bar count for `setVisibleLogicalRange` |
| `isIntraday(iv)` | True when interval is not `'day'` |
| `toTimestamp(iso)` | ISO string → `UTCTimestamp` (seconds) for lightweight-charts |
| `getFromIndex(data, tf, iv)` | Returns the start index for the current timeframe window; handles YTD and ALL specially |
| `computeChange(data, fromIdx)` | `{ abs, pct }` change from window-open to last close |
| `formatChange(change, currency)` | Formats as `"+$12.34 (+2.50%)"` with correct currency symbol |

### `utils/statsUtils.ts`

| Export | Description |
|---|---|
| `price(n, currency)` | Formats a number as a currency string using `Intl.NumberFormat`; returns `"—"` for null |
| `compactVol(n)` | Compact volume: `82.3M`, `1.2B`, etc. |
| `compactCap(n, currency)` | Same for market cap (defined but not rendered — market cap unavailable on free plan) |

---

## 11. Key Library Gotchas

### lightweight-charts v5

`addCandlestickSeries()` is removed. Use the generic `addSeries()`:

```ts
import { CandlestickSeries, AreaSeries, HistogramSeries } from 'lightweight-charts';

chart.addSeries(CandlestickSeries, { upColor: '#22c55e', ... });
chart.addSeries(AreaSeries,        { lineColor: '#3b82f6', ... });
chart.addSeries(HistogramSeries,   { priceScaleId: 'volume' });
```

Intraday data must use `UTCTimestamp` (integer seconds), not date strings:
```ts
Math.floor(new Date(isoString).getTime() / 1000) as UTCTimestamp
```

### Twelve Data free plan

- 800 API credits per day, 8 per minute. Each `/time_series` call costs 1 credit.
- Daily history is PostgreSQL-cached so each new ticker costs ~2 credits, then 0.
- Stats, news (company name lookup), and intraday each cost 1 credit per request.
- Intraday data: maximum 59 days back regardless of interval.
- International tickers need colon format: `ESLT:TASE`, `VOD:LSE`. `toTDSymbol()` handles this.
- `market_cap` is **not available** on the free `/quote` endpoint — always `null`.

### NewsAPI free plan

- 100 requests per day. Each `/api/stocks/:ticker/news` call costs 1 request (plus 1 Twelve
  Data call for the company name lookup).
- Articles from the last 30 days only.
- The developer plan is intended for development and testing, not production traffic.

### Next.js 16 App Router

- All components are Server Components by default. Add `'use client'` at the top for anything
  using React state, effects, or browser APIs.
- `dynamic(() => import(...), { ssr: false })` is required for `StockChart` because
  lightweight-charts accesses the DOM at import time.

---

## 12. Known Limitations

| Limitation | Detail |
|---|---|
| US markets only (data) | Twelve Data free plan has sparse coverage for non-US exchanges. International tickers are filtered out of the autocomplete dropdown. |
| Market cap unavailable | Always shows `null` — not in the Twelve Data free `/quote` response. |
| Intraday not persisted | 1h / 30m / 15m bars are fetched live and held in React state. Refreshing the page clears them. |
| News: last 30 days | NewsAPI free plan restriction. Older articles are not accessible. |
| Rate limits | With both APIs on free plans, heavy testing can exhaust daily quotas quickly. |
| No authentication | The API is open — anyone who can reach port 3001 can query it. |

---

## 13. V2 Roadmap

| Version | Feature | Plan |
|---|---|---|
| V2a | Technical indicators | Python microservice (FastAPI) reads from the same PostgreSQL DB, computes RSI / MACD / Moving Averages with `pandas-ta`, exposes them as JSON. Node.js API proxies the results. Chart gains toggleable overlay series. |
| V2b | Containerisation | Docker Compose wraps Node.js API, Python service, PostgreSQL, and Redis. No application changes — just reproducible deploys with one command. |
| V2c | AI news sentiment | NewsAPI headlines piped through Claude API (or OpenAI). Sentiment score + plain-English summary shown in a side panel next to the chart. |
| V2d | ML signal | scikit-learn classifier trained on historical indicator data (RSI, MACD, MA crossovers) produces a Bullish / Neutral / Bearish badge with a confidence score. |
