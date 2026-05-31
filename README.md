# Stock Intel

A full-stack stock intelligence dashboard. Search any US ticker, explore interactive price charts with technical indicators, read AI-analysed news sentiment, and browse analyst recommendations — all backed by a PostgreSQL cache so repeat lookups are near-instant.

---

## Features

- **Ticker search** — debounced autocomplete dropdown with keyboard navigation, powered by Twelve Data's symbol search API
- **Interactive chart** — candlestick or area chart built on TradingView's `lightweight-charts` v5, with a volume histogram and floating crosshair tooltip (OHLCV values)
- **Timeframes** — 1D / 5D / 1M / 3M / 6M / YTD / 1Y / ALL
- **Intervals** — Day (daily bars), 1H, 30m, 15m; intraday data is fetched live and cached in-memory for the session
- **Technical indicators** (requires Python service) — toggleable overlays: SMA 20/50/200, EMA 12/26; sub-panels: RSI, MACD
- **Stats panel** — Open, Last Close, Highest Close, 52-Week Range, Total Volume; currency adapts to the stock's native currency (USD, ILS, GBP, etc.)
- **Analyst ratings** — Finnhub consensus bar showing Strong Buy / Buy / Hold / Sell / Strong Sell
- **AI news sentiment** — headlines from Marketaux enriched by OpenAI `gpt-4o-mini`; shows a BULLISH / NEUTRAL / BEARISH label, a 0–100 confidence score, and a plain-English summary
- **News section** — up to 10 recent articles (last 60 days) with thumbnails, publisher, and relative timestamp
- **Recent searches** — last 8 tickers, persisted in `localStorage`
- **Watchlist** — star any ticker to save it; persisted in `localStorage`
- **Dark / light theme** — full theme toggle; every component is theme-aware
- **AI chatbot** — floating "Ask about AAPL" button opens a side panel that pushes the main content left; multi-turn conversation streamed token-by-token (SSE) and grounded on live price data, analyst consensus, and news sentiment; suggested starter questions on empty state; context window capped at 20 messages per request, session capped at 100 messages

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend language | TypeScript 5 | Hot-reloaded with `tsx watch` |
| Backend framework | Fastify 5 | Built-in logger, schema validation |
| Database | PostgreSQL 14+ | Price history cache via `pg` Pool |
| Stock data | Twelve Data API | 800 req/day free plan |
| News data | Marketaux API | Symbol-filtered news |
| Analyst data | Finnhub API | Free plan consensus endpoint |
| AI sentiment | OpenAI `gpt-4o-mini` | Optional; graceful no-op without key |
| Technical indicators | Python FastAPI (separate service) | Optional; proxied via Node.js API |
| Frontend | Next.js 16 (App Router) | Turbopack dev server |
| Styling | Tailwind CSS 4 | No config file needed in v4 |
| Charting | lightweight-charts 5 | TradingView open-source |
| Runtime | Node.js 20 LTS | Both workspaces |
| Test runner | Vitest | Unit tests for pure utility functions |

---

## Project Structure

```
Stock_Intel/
│
├── api/                          ← Node.js / Fastify backend (port 3001)
│   └── src/
│       ├── index.ts              ← Server entry: registers CORS + routes, starts Fastify
│       ├── db/
│       │   ├── client.ts         ← Single pg.Pool instance exported as `db`
│       │   └── schema.sql        ← DDL for `stocks` and `price_history` tables
│       ├── routes/
│       │   └── stocks.ts         ← All HTTP routes; `tickerRoute()` wraps error handling
│       └── services/
│           ├── stockService.ts   ← All business logic, external API calls, ServiceError class
│           └── newsUtils.ts      ← Pure helpers: buildFilterTerms, filterRelevantNews
│
├── frontend/                     ← Next.js 16 frontend (port 3000)
│   └── src/
│       ├── app/
│       │   └── page.tsx          ← Root page; owns all state; exports shared types
│       ├── components/
│       │   ├── StockChart.tsx    ← lightweight-charts wrapper (dynamic, SSR disabled)
│       │   ├── RSIChart.tsx      ← RSI sub-panel
│       │   ├── MACDChart.tsx     ← MACD sub-panel
│       │   ├── StatsPanel.tsx    ← Five stat cards below the chart
│       │   ├── AnalystBar.tsx    ← Finnhub analyst ratings bar
│       │   ├── SentimentPanel.tsx ← AI sentiment badge + summary
│       │   ├── ChatPanel.tsx     ← AI chatbot side panel (SSE streaming, push layout)
│       │   ├── TickerAutocomplete.tsx ← Debounced search dropdown
│       │   ├── NewsSection.tsx   ← News card grid with skeleton loading
│       │   ├── IndicatorToggles.tsx ← MA / RSI / MACD toggle buttons
│       │   ├── QuickAccess.tsx   ← Recent searches + watchlist chips
│       │   └── StockLoader.tsx   ← Animated candlestick spinner
│       └── utils/
│           ├── chartUtils.ts     ← getFromIndex, computeChange, toTimestamp, isIntraday
│           └── statsUtils.ts     ← price(), compactVol() formatters
│
├── indicators/                   ← Python FastAPI microservice (port 8000)
│   ├── main.py                   ← FastAPI app; single GET /indicators/:ticker endpoint
│   ├── indicators.py             ← compute_indicators(): pandas-ta calculations
│   ├── db.py                     ← asyncpg connection pool (reads same PostgreSQL DB)
│   ├── requirements.txt          ← fastapi, uvicorn, asyncpg, pandas<2.0, pandas-ta, python-dotenv
│   └── .env                      ← DATABASE_URL (shared with the Node.js API)
│
├── README.md
└── GETTING_STARTED.md            ← Detailed setup and architecture reference
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| PostgreSQL | 14+ |
| Python | 3.10+ (for the indicators service) |

---

## Setup

### 1. Create the database

```sql
CREATE DATABASE stock_intelligence;
```

Apply the schema:

```bash
psql -U postgres -d stock_intelligence -f api/src/db/schema.sql
```

### 2. Get API keys

| Service | Purpose | Free tier |
|---|---|---|
| [Twelve Data](https://twelvedata.com) | Price history, intraday, stats, search | 800 req/day |
| [Marketaux](https://www.marketaux.com) | Stock news | 100 req/day |
| [Finnhub](https://finnhub.io) | Analyst recommendations | Free |
| [OpenAI](https://platform.openai.com) | AI news sentiment (optional) | Pay-per-use |

### 3. Configure environment variables

Create `api/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/stock_intelligence
TWELVE_DATA_API_KEY=your_key_here
NEWS_API_KEY=your_marketaux_key_here
FINNHUB_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here          # optional — sentiment disabled if absent
PYTHON_SERVICE_URL=http://localhost:8000  # optional — indicators disabled if absent
PORT=3001
# HOST=0.0.0.0
# CORS_ORIGIN=http://localhost:3000
```

Optionally create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Install dependencies

```bash
cd api      && npm install
cd frontend && npm install
```

### 5. Set up the Python indicators service (optional)

The indicators service reads from the **same PostgreSQL database** as the Node.js API — no extra data source needed.

```bash
cd indicators

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
```

Create `indicators/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/stock_intelligence
```

---

## Running the App

Three terminals for the full stack (indicators service is optional):

```bash
# Terminal 1 — Node.js API (hot-reload)
cd api && npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:3000

# Terminal 3 — Python indicators service (optional)
cd indicators
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

Other commands:

```bash
cd api      && npm test          # unit tests (Vitest)
cd api      && npm run build     # compile to api/dist/
cd frontend && npm run build     # Next.js production build
cd frontend && npm run lint
```

---

## API Reference

Base URL: `http://localhost:3001`

All `:ticker` params must match `/^[A-Za-z0-9]{1,10}(\.[A-Za-z]{1,4})?$/`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stocks/search?q=<query>` | Autocomplete — up to 8 US ticker matches |
| `GET` | `/api/stocks/:ticker` | Daily OHLCV history from 2000-01-01 (PostgreSQL-cached) |
| `GET` | `/api/stocks/:ticker/hourly` | 1-hour bars, last 59 days (live) |
| `GET` | `/api/stocks/:ticker/30min` | 30-minute bars, last 59 days (live) |
| `GET` | `/api/stocks/:ticker/15min` | 15-minute bars, last 59 days (live) |
| `GET` | `/api/stocks/:ticker/stats` | Live quote: name, exchange, currency, open, last close, 52-wk range, volume |
| `GET` | `/api/stocks/:ticker/news` | Up to 10 recent Marketaux headlines (last 60 days) |
| `GET` | `/api/stocks/:ticker/news-sentiment` | News articles enriched with OpenAI sentiment labels |
| `GET` | `/api/stocks/:ticker/recommendations` | Finnhub analyst consensus (Strong Buy → Strong Sell) |
| `GET` | `/api/stocks/:ticker/indicators` | Technical indicators proxied from Python service |
| `POST` | `/api/stocks/:ticker/chat` | AI chatbot — streams SSE tokens grounded on live stock data; body: `{ messages: [{role, content}] }` |

**Error shape:** `{ "error": "<message>" }` with HTTP 400 / 404 / 500 / 502 / 503.

**Chat endpoint notes:**
- Returns `503` if `OPENAI_API_KEY` is not set.
- Response is a text/event-stream SSE stream. Each chunk: `data: {"token":"..."}`. End marker: `data: [DONE]`.
- The last 20 messages are sent to the model per request (older turns are trimmed from the API call but remain visible in the UI).
- Sessions are stateless on the server — the full conversation history is sent by the client on every request.

---

## Database Schema

```sql
CREATE TABLE stocks (
    id         SERIAL PRIMARY KEY,
    ticker     VARCHAR(10) NOT NULL UNIQUE,
    name       VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE price_history (
    id       SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    date     DATE NOT NULL,
    open     DECIMAL(12, 4),
    high     DECIMAL(12, 4),
    low      DECIMAL(12, 4),
    close    DECIMAL(12, 4),
    volume   BIGINT,
    UNIQUE(stock_id, date)
);

CREATE INDEX idx_price_history_stock_date ON price_history(stock_id, date DESC);
```

**Cache-on-demand pattern:** the first request for any ticker fetches up to two batches of 5 000 bars from Twelve Data (going back to 2000-01-01) and stores them in PostgreSQL. Every subsequent request is served entirely from the database. `ensureFullHistory()` checks on each cache hit whether older data is still missing and backfills silently if needed.

---

## Architecture & Data Flow

### Daily price fetch — first request

```
Search "AAPL"
  → GET /api/stocks/AAPL
    → stockService.getOrFetchStock("AAPL")
      → SELECT id FROM stocks WHERE ticker = 'AAPL'  -- not found
      → tdFetch /time_series (batch 1, up to 5 000 bars from 2000-01-01)
      → if batch 1 = 5 000 rows → tdFetch /time_series (batch 2 to fill gap)
      → tdFetch /quote  -- company name (best-effort)
      → INSERT INTO stocks; INSERT INTO price_history ... ON CONFLICT DO NOTHING
      → SELECT price_history ORDER BY date ASC
  ← PriceRow[]
```

### Daily price fetch — cached

```
  → SELECT id FROM stocks  -- found
  → ensureFullHistory(): SELECT MIN(date); backfill from 2000-01-01 if needed
  → SELECT price_history ORDER BY date ASC
  ← PriceRow[] (no Twelve Data call)
```

### Intraday fetch (always live, not stored)

```
  → tdFetch /time_series with interval=1h/30min/15min, last 59 days
  ← PriceRow[] (not written to DB; memoised in React state per session)
```

### News + AI sentiment

```
  → fetchNews(ticker)
      → Marketaux /news/all?symbols=TICKER
      → filter articles older than 60 days
  → fetchNewsSentiment(ticker)
      → OpenAI gpt-4o-mini: label each article BULLISH / NEUTRAL / BEARISH
      → produce overall sentiment: label + score (0–100) + 2–3 sentence summary
  ← { articles: NewsArticle[], overall: NewsSentiment | null }
```

### AI chatbot (SSE streaming)

```
User sends message in ChatPanel
  → POST /api/stocks/AAPL/chat  { messages: [...last 20] }
    → Promise.all([fetchStats, fetchNewsSentiment, fetchRecommendations])
    → Build system prompt (price, 52-wk range, volume, analyst consensus, sentiment, headlines)
    → OpenAI gpt-4o-mini stream=true
    → reply.hijack(); reply.raw.setHeader('Content-Type', 'text/event-stream')
    → for await chunk: reply.raw.write(`data: {"token":"..."}\n\n`)
    → reply.raw.write('data: [DONE]\n\n'); reply.raw.end()
  ← ChatPanel ReadableStream reader appends each token to the last assistant message in state
```

**Context management:**
- Only the last 20 messages are sent to the API per request — older turns are trimmed from the payload but remain visible in the panel.
- After 100 total messages, the input is locked and a "session limit reached" notice is shown. Searching a new ticker resets the session.

### International tickers (dot → colon conversion)

`toTDSymbol()` translates dot-suffix format to Twelve Data's colon format:

| Input | Sent to Twelve Data |
|---|---|
| `AAPL` | `AAPL` |
| `ESLT.TA` | `ESLT:TASE` |
| `MSFT.L` | `MSFT:LSE` |

---

## Python Indicators Service

The `indicators/` folder is a standalone **FastAPI** microservice (Python 3.10+) that computes technical indicators from the price history already stored in PostgreSQL. The Node.js API proxies requests to it via `PYTHON_SERVICE_URL`; if that variable is unset the indicators endpoint returns 503 and the frontend silently hides all indicator toggles.

### Files

| File | Purpose |
|---|---|
| [main.py](indicators/main.py) | FastAPI app; single endpoint `GET /indicators/:ticker`; warms the asyncpg pool on startup |
| [indicators.py](indicators/indicators.py) | `compute_indicators(dates, closes)` — builds a pandas DataFrame and runs all `pandas_ta` calculations |
| [db.py](indicators/db.py) | Lazy asyncpg connection pool singleton; reads `DATABASE_URL` from `.env` |
| [requirements.txt](indicators/requirements.txt) | `fastapi`, `uvicorn[standard]`, `asyncpg`, `pandas<2.0`, `pandas-ta`, `python-dotenv` |

### How it works

```
GET /indicators/AAPL
  → asyncpg: SELECT date, close FROM price_history JOIN stocks WHERE ticker='AAPL' ORDER BY date ASC
  → compute_indicators(dates, closes)
      → pandas DataFrame + pandas_ta:
          sma(20), sma(50), sma(200)
          ema(12), ema(26)
          rsi(14)
          macd(fast=12, slow=26, signal=9)
      → NaN rows dropped per series
  ← {
      "sma20":  [{ "time": "2024-01-02", "value": 182.5 }, ...],
      "sma50":  [...],
      "sma200": [...],
      "ema12":  [...],
      "ema26":  [...],
      "rsi":    [...],
      "macd":   [{ "time": "...", "macd": 1.23, "signal": 0.98, "histogram": 0.25 }, ...]
    }
```

The service reads **read-only** from the database — it never writes. Because it shares the same PostgreSQL instance, no data synchronisation is needed: indicators are always computed from the latest cached price history.

### Indicator reference

| Indicator | Parameters | Chart placement |
|---|---|---|
| SMA 20 | 20-day simple moving average | Price chart overlay (amber) |
| SMA 50 | 50-day simple moving average | Price chart overlay (blue) |
| SMA 200 | 200-day simple moving average | Price chart overlay (purple) |
| EMA 12 | 12-day exponential moving average | Price chart overlay (rose) |
| EMA 26 | 26-day exponential moving average | Price chart overlay (teal) |
| RSI 14 | 14-period RSI | Separate sub-panel below chart |
| MACD | Fast 12 / Slow 26 / Signal 9 | Separate sub-panel below chart |

---

## Known Limitations

| Limitation | Detail |
|---|---|
| US markets only | Autocomplete filters to US tickers; Twelve Data free plan has sparse non-US coverage |
| Market cap unavailable | Always `null` — not in the Twelve Data free `/quote` response |
| Intraday not persisted | 1H / 30m / 15m bars are held in React state; a page refresh re-fetches |
| News: last 60 days | Marketaux free plan restriction |
| Rate limits | Heavy testing can exhaust daily API quotas quickly |
| No authentication | The API is open to anyone who can reach port 3001 |
| Indicators require Python service | RSI, MACD, and MA overlays are disabled unless `PYTHON_SERVICE_URL` is set |
| Chatbot re-fetches on every turn | Stats, news, and recommendations are fetched fresh for every chat request |
| Chatbot context window | Only the last 20 messages are sent to the model; very long conversations lose early context |
| Chatbot session cap | After 100 messages the session is locked; the user must search a new ticker to reset |

---

## Roadmap

| Feature | Status | Plan |
|---|---|---|
| Technical indicators (RSI, MACD, SMA, EMA) | Implemented | Python FastAPI microservice reads from PostgreSQL, computes with `pandas-ta` |
| AI news sentiment | Implemented | OpenAI `gpt-4o-mini` per-article + overall label |
| Analyst recommendations | Implemented | Finnhub consensus bar |
| AI chatbot | Implemented | Floating side panel; SSE streaming; grounded on live price, analyst, and news data; 20-msg context window; 100-msg session cap |
| Containerisation | Planned | Docker Compose: Node.js API + Python service + PostgreSQL |
| ML signal | Planned | scikit-learn classifier → Bullish / Neutral / Bearish badge with confidence score |
