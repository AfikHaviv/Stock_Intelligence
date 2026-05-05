# Stock Intelligence Dashboard — V1 Getting Started Guide

> **What we're building in V1:** A full-stack web app where you can search any stock ticker,
> fetch its price history from Yahoo Finance, store it in a PostgreSQL database, and view an
> interactive price chart on a clean dashboard. Simple, focused, and fully working end-to-end.

---

## Table of Contents

1. [What V1 Looks Like](#1-what-v1-looks-like)
2. [Tech Stack](#2-tech-stack)
3. [What You Need to Install](#3-what-you-need-to-install)
4. [Project Folder Structure](#4-project-folder-structure)
5. [Step-by-Step Setup](#5-step-by-step-setup)
   - [5.1 Install Node.js](#51-install-nodejs)
   - [5.2 Install PostgreSQL](#52-install-postgresql)
   - [5.3 Set Up the API Project](#53-set-up-the-api-project)
   - [5.4 Set Up the Database](#54-set-up-the-database)
   - [5.5 Set Up the Frontend Project](#55-set-up-the-frontend-project)
6. [First Files to Create](#6-first-files-to-create)
7. [How the Pieces Connect](#7-how-the-pieces-connect)
8. [What "Done" Looks Like for V1](#8-what-done-looks-like-for-v1)
9. [What Comes Next (V2 Preview)](#9-what-comes-next-v2-preview)

---

## 1. What V1 Looks Like

The finished V1 is a two-part application:

**Backend (API):** A Node.js server written in TypeScript. When the frontend requests data for
a stock ticker (e.g. `AAPL`), the API checks if we already have that data in PostgreSQL.
If we do, it returns it immediately. If not, it fetches the last 6 months of daily price data
from Yahoo Finance, saves it to the database, and then returns it. This pattern is called
**cache-on-demand** and is a real pattern used in production systems.

**Frontend (Dashboard):** A Next.js web app with a search bar where you type a ticker symbol.
It calls your API, receives the price history, and renders an interactive candlestick or line
chart using TradingView's free charting library. The UI is minimal but professional.

That's the whole V1. No machine learning, no AI, no message queues. Just solid full-stack
fundamentals done cleanly.

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend language | TypeScript (Node.js) | Type safety catches bugs early; industry standard |
| Backend framework | Fastify | Faster than Express, built-in schema validation, modern |
| Database | PostgreSQL | Relational, excellent for time-series price data, industry standard |
| Stock data | `yahoo-finance2` (npm) | Free, no API key needed, pulls real Yahoo Finance data |
| Frontend framework | Next.js 14 | React-based, great developer experience, used everywhere |
| Frontend styling | Tailwind CSS | Utility-first, fast to write, clean results |
| Charting library | TradingView Lightweight Charts | Free, professional-grade financial charts |
| Language runtime | Node.js 20 LTS | Current long-term support version |

---

## 3. What You Need to Install

Install these on your Windows machine before writing any code.

### Node.js
Download the **LTS (Long Term Support)** version from https://nodejs.org — choose the Windows
installer (.msi). Run it and accept all defaults. To verify it worked, open a new terminal and run:
```
node --version
npm --version
```
Both should print a version number.

### PostgreSQL
Download the Windows installer from https://www.postgresql.org/download/windows/ — click
"Download the installer" under Interactive Installer by EDB.

During installation:
- Set a password for the `postgres` superuser — **write this down**, you'll need it.
- Keep the default port: `5432`
- Keep all default components selected (PostgreSQL Server, pgAdmin, Stack Builder)

After installation, open **pgAdmin** (it gets installed alongside PostgreSQL) to confirm the
database server is running. You'll see it in the left panel.

### Git
If you don't have Git already: https://git-scm.com/download/win — accept all defaults during
installation. This gives you Git Bash as well, which is useful.

### VS Code
If not already installed: https://code.visualstudio.com

Recommended extensions to install inside VS Code:
- **ESLint** — catches code errors as you type
- **Prettier** — auto-formats your code
- **Prisma** — syntax highlighting for database schema files (useful later)
- **Thunder Client** — lets you test your API endpoints directly in VS Code (like Postman)

---

## 4. Project Folder Structure

Your project lives in this folder (`stock_market_pred`). Here is the structure you will build:

```
stock_market_pred/
│
├── api/                          ← Node.js TypeScript backend
│   ├── src/
│   │   ├── db/
│   │   │   ├── client.ts         ← Database connection setup
│   │   │   └── schema.sql        ← SQL to create your tables
│   │   ├── routes/
│   │   │   └── stocks.ts         ← API route: /api/stocks/:ticker
│   │   ├── services/
│   │   │   └── stockService.ts   ← Business logic: fetch + store stock data
│   │   └── index.ts              ← Entry point, starts the server
│   ├── .env                      ← Your secrets (DB password, etc.) — never commit this
│   ├── .env.example              ← Template showing what variables are needed
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     ← Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          ← Home page with search bar
│   │   │   └── layout.tsx        ← Root layout
│   │   └── components/
│   │       ├── StockChart.tsx    ← TradingView chart component
│   │       └── SearchBar.tsx     ← Ticker search input
│   ├── package.json
│   └── next.config.ts
│
├── GETTING_STARTED.md            ← This file
└── README.md                     ← Project overview (write this last)
```

---

## 5. Step-by-Step Setup

Open a terminal (PowerShell or Git Bash) in this folder before running any commands.

---

### 5.1 Install Node.js

Already covered in section 3. Once installed, verify:
```bash
node --version   # should show v20.x.x or higher
npm --version    # should show 10.x.x or higher
```

---

### 5.2 Install PostgreSQL

Already covered in section 3. After installation:

1. Open **pgAdmin** from the Start menu.
2. Connect to the local server using the password you set during installation.
3. Right-click **Databases** → **Create** → **Database**.
4. Name it: `stock_intelligence`
5. Click Save.

Your database now exists. You'll create the tables inside it in step 5.4.

Alternatively, if you prefer the command line, open **SQL Shell (psql)** from the Start menu:
```sql
CREATE DATABASE stock_intelligence;
```

---

### 5.3 Set Up the API Project

In your terminal, navigate to this folder and run:

```bash
# Create the api folder and enter it
mkdir api
cd api

# Initialise a Node.js project (creates package.json)
npm init -y

# Install runtime dependencies
npm install fastify @fastify/cors dotenv pg yahoo-finance2

# Install development dependencies (TypeScript tooling)
npm install -D typescript @types/node @types/pg ts-node tsx

# Generate a TypeScript config file
npx tsc --init
```

**Edit `tsconfig.json`** — replace its contents with this clean config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Add scripts to `package.json`** — open it and update the `"scripts"` section:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

**Create the `.env` file** inside the `api/` folder:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/stock_intelligence
PORT=3001
```

Replace `YOUR_PASSWORD_HERE` with the PostgreSQL password you set during installation.

**Create `.env.example`** (same file but with no real values — safe to commit to Git):

```
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/stock_intelligence
PORT=3001
```

Go back to the project root:
```bash
cd ..
```

---

### 5.4 Set Up the Database

Create the file `api/src/db/schema.sql` with this content:

```sql
-- Stores the list of stock tickers we have data for
CREATE TABLE IF NOT EXISTS stocks (
    id          SERIAL PRIMARY KEY,
    ticker      VARCHAR(10)  NOT NULL UNIQUE,
    name        VARCHAR(255),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Stores daily price data for each stock
CREATE TABLE IF NOT EXISTS price_history (
    id          SERIAL PRIMARY KEY,
    stock_id    INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    open        DECIMAL(12, 4),
    high        DECIMAL(12, 4),
    low         DECIMAL(12, 4),
    close       DECIMAL(12, 4),
    volume      BIGINT,
    UNIQUE(stock_id, date)
);

-- Index for fast date-range queries on price history
CREATE INDEX IF NOT EXISTS idx_price_history_stock_date
    ON price_history(stock_id, date DESC);
```

Run this SQL against your database. In pgAdmin: open your `stock_intelligence` database,
click **Query Tool**, paste the SQL above, and press the Run button (▶).

Or in psql:
```bash
psql -U postgres -d stock_intelligence -f api/src/db/schema.sql
```

Your tables now exist. You can see them in pgAdmin under
`stock_intelligence → Schemas → public → Tables`.

---

### 5.5 Set Up the Frontend Project

From the project root:

```bash
# Create the Next.js app (select TypeScript, Tailwind, App Router when prompted)
npx create-next-app@latest frontend

# When it asks:
# ✔ Would you like to use TypeScript? → Yes
# ✔ Would you like to use ESLint? → Yes
# ✔ Would you like to use Tailwind CSS? → Yes
# ✔ Would you like to use the src/ directory? → Yes
# ✔ Would you like to use App Router? → Yes
# ✔ Would you like to customize the import alias? → No

cd frontend

# Install TradingView Lightweight Charts
npm install lightweight-charts

cd ..
```

---

## 6. First Files to Create

Once setup is complete, these are the first real source files to write — in this order:

**1. `api/src/db/client.ts`** — Database connection
This file creates a single shared PostgreSQL connection pool that the rest of the API uses.
Using a pool (rather than a new connection per request) is the correct production pattern.

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

**2. `api/src/services/stockService.ts`** — Business logic
This is the brain of the API. It contains two functions:
- `getOrFetchStock(ticker)` — checks the DB first; if no data exists, fetches from Yahoo Finance
- `getPriceHistory(stockId)` — retrieves stored price data for a given stock

**3. `api/src/routes/stocks.ts`** — API routes
Registers the HTTP endpoints with Fastify:
- `GET /api/stocks/:ticker` — returns price history for a ticker (triggers fetch if not cached)

**4. `api/src/index.ts`** — Server entry point
Creates the Fastify server, registers CORS (so the frontend can call the API), registers your
routes, and starts listening on the port defined in `.env`.

**5. `frontend/src/components/StockChart.tsx`** — The chart component
Wraps TradingView Lightweight Charts in a React component. Accepts an array of price data as
props and renders an interactive line or candlestick chart.

**6. `frontend/src/app/page.tsx`** — The home page
Contains the search bar. When you submit a ticker, it calls your API, stores the response in
React state, and passes the data to `StockChart`.

---

## 7. How the Pieces Connect

Here is the data flow from end to end:

```
User types "AAPL" → hits Enter
        ↓
frontend/page.tsx calls:
GET http://localhost:3001/api/stocks/AAPL
        ↓
api/routes/stocks.ts receives the request
        ↓
api/services/stockService.ts runs:
  → Query PostgreSQL: "do we have AAPL?"
  → If NO: call yahoo-finance2 → get 6 months of daily prices
            → INSERT into stocks table
            → INSERT into price_history table
  → Return price_history rows
        ↓
API responds with JSON array of { date, open, high, low, close, volume }
        ↓
frontend/StockChart.tsx receives the data
        ↓
TradingView Lightweight Charts renders the price chart
        ↓
User sees the chart
```

The second time you search for AAPL, the API finds it in the database and skips the Yahoo
Finance call entirely — the response is nearly instant.

---

## 8. What "Done" Looks Like for V1

V1 is complete when you can do all of the following:

- [ ] Run `npm run dev` in the `api/` folder and see "Server running on port 3001"
- [ ] Open the frontend (`npm run dev` in `frontend/`) and see the dashboard at `localhost:3000`
- [ ] Type `AAPL` in the search bar and see a price chart render
- [ ] Type `MSFT` and see a different chart render
- [ ] Check pgAdmin and see rows in the `stocks` and `price_history` tables
- [ ] Search `AAPL` a second time and notice it loads faster (served from DB, not Yahoo Finance)
- [ ] Open VS Code's Thunder Client and test `GET localhost:3001/api/stocks/TSLA` directly

If all of these work, you have a real, functioning full-stack application with a proper
separation between API, business logic, and database — the foundation that V2 will build on.

---

## 9. What Comes Next (V2 Preview)

Once V1 is solid, here is what V2 adds — one piece at a time:

**V2a — Technical Indicators:** Add a Python microservice that reads from the same PostgreSQL
database and computes RSI, MACD, and Moving Averages using `pandas-ta`. The Node.js API calls
this service and includes indicator data in its response. The chart gains toggleable overlays.

**V2b — Docker:** Wrap the Node.js API, Python service, PostgreSQL, and Redis in Docker Compose.
Nothing about the application changes — it just becomes reproducible on any machine with one
command.

**V2c — News + AI:** Add a news fetch step (NewsAPI) and pass headlines to OpenAI to get
sentiment scores and a plain-English summary for each stock. Surface this in a panel next to
the chart.

**V2d — ML Signal:** Train a scikit-learn classifier on historical indicator data to generate
a Bullish / Neutral / Bearish signal for each stock. Show a confidence badge on the dashboard.

---

*Start with V1. Get it working. Understand every line. Then expand.*
