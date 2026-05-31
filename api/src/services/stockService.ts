import { db } from '../db/client.js';
import type { NewsArticle } from './newsUtils.js';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TD_BASE = 'https://api.twelvedata.com';

/** Maps dot-format exchange suffixes to Twelve Data colon-format exchange codes. */
const EXCHANGE_MAP: Record<string, string> = {
  TA: 'TASE',
  L: 'LSE',
  PA: 'XPAR',
  DE: 'XETR',
  AS: 'XAMS',
  TO: 'TSX',
  HK: 'HKEX',
};

function toTDSymbol(ticker: string): string {
  const dot = ticker.indexOf('.');
  if (dot === -1) return ticker;
  const symbol = ticker.slice(0, dot);
  const suffix = ticker.slice(dot + 1);
  return `${symbol}:${EXCHANGE_MAP[suffix] ?? suffix}`;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ---------------------------------------------------------------------------
// Twelve Data fetch wrapper
// ---------------------------------------------------------------------------

interface TDError {
  code: number;
  message: string;
  status: 'error';
}

async function tdFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new ServiceError(500, 'TWELVE_DATA_API_KEY not configured');

  const url = new URL(`${TD_BASE}${path}`);
  url.searchParams.set('apikey', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new ServiceError(502, `Twelve Data HTTP ${res.status}`);

  const data = (await res.json()) as T | TDError;

  if ((data as TDError).status === 'error') {
    const err = data as TDError;
    const msg = (err.message ?? '').toLowerCase();
    const isNotFound =
      err.code === 404 ||
      msg.includes('not found') ||
      msg.includes('not valid') ||
      msg.includes('not covered') ||
      msg.includes('not available') ||
      msg.includes('subscription');
    if (isNotFound) throw new ServiceError(404, err.message ?? 'Ticker not found');
    throw new ServiceError(502, err.message ?? 'Twelve Data error');
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Twelve Data response shapes
// ---------------------------------------------------------------------------

interface TDBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TDTimeSeries {
  values: TDBar[];
  status: string;
}

interface TDQuote {
  name?: string;
  exchange?: string;
  currency?: string;
  open?: string;
  close?: string;
  volume?: string;
  fifty_two_week?: { high: string; low: string };
  status?: string;
}

interface TDSearchItem {
  symbol: string;
  instrument_name: string;
  exchange: string;
  instrument_type: string;
  country?: string;
}

interface TDSearchResult {
  data: TDSearchItem[];
  status: string;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockStats {
  name: string;
  exchangeName: string;
  currency: string;
  marketCap: null;
  close: number | null;
  open: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
}

export interface Suggestion {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function parseBar(b: TDBar) {
  return {
    datetime: b.datetime,
    open: parseFloat(b.open),
    high: parseFloat(b.high),
    low: parseFloat(b.low),
    close: parseFloat(b.close),
    volume: parseInt(b.volume, 10) || 0,
  };
}

/** Bulk-upsert price bars in chunks to stay under PostgreSQL's 65 535 param limit. */
async function insertPriceHistory(stockId: number, bars: TDBar[]): Promise<void> {
  if (bars.length === 0) return;

  const CHUNK = 500; // 500 rows × 6 params + 1 = 3 001 params per query — safely under limit
  for (let i = 0; i < bars.length; i += CHUNK) {
    const chunk = bars.slice(i, i + CHUNK);
    const params: (string | number)[] = [stockId];
    const placeholders = chunk.map((b, idx) => {
      const base = idx * 6 + 2;
      const parsed = parseBar(b);
      params.push(parsed.datetime, parsed.open, parsed.high, parsed.low, parsed.close, parsed.volume);
      return `($1, $${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    await db.query(
      `INSERT INTO price_history (stock_id, date, open, high, low, close, volume)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (stock_id, date) DO NOTHING`,
      params
    );
  }
}

/** Returns all stored bars for a stock, ordered ASC. */
async function selectPriceHistory(stockId: number): Promise<PriceRow[]> {
  const { rows } = await db.query<PriceRow>(
    `SELECT date::text, open::float8 AS open, high::float8 AS high,
            low::float8 AS low, close::float8 AS close, volume
     FROM price_history
     WHERE stock_id = $1
     ORDER BY date ASC`,
    [stockId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// ensureFullHistory
// ---------------------------------------------------------------------------

/**
 * If the earliest cached bar is newer than 2 years ago, backfill from 2000-01-01.
 * Called on every cache hit so gaps are eventually filled without user-facing cost.
 */
async function ensureFullHistory(stockId: number, ticker: string): Promise<void> {
  const { rows } = await db.query<{ min_date: Date | null }>(
    'SELECT MIN(date) AS min_date FROM price_history WHERE stock_id = $1',
    [stockId]
  );

  const minDate = rows[0]?.min_date;
  if (!minDate) return;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  if (minDate <= twoYearsAgo) return; // Already have enough history

  const tdSymbol = toTDSymbol(ticker);
  const endDate = minDate.toISOString().slice(0, 10);

  try {
    const batch = await tdFetch<TDTimeSeries>('/time_series', {
      symbol: tdSymbol,
      interval: '1day',
      outputsize: '5000',
      start_date: '2000-01-01',
      end_date: endDate,
      order: 'ASC',
    });
    if (batch.values?.length) await insertPriceHistory(stockId, batch.values);
  } catch {
    // Best-effort — don't let a backfill failure break a cached read
  }
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/** Returns full daily price history for a ticker, fetching from Twelve Data on first request. */
export async function getOrFetchStock(ticker: string): Promise<PriceRow[]> {
  const { rows: found } = await db.query<{ id: number }>(
    'SELECT id FROM stocks WHERE ticker = $1',
    [ticker]
  );

  if (found.length > 0) {
    const stockId = found[0].id;
    await ensureFullHistory(stockId, ticker);
    return selectPriceHistory(stockId);
  }

  // --- New ticker: fetch from Twelve Data ---
  const tdSymbol = toTDSymbol(ticker);

  // Time series batch 1 — validates ticker; throws ServiceError(404) for unknown tickers
  const batch1 = await tdFetch<TDTimeSeries>('/time_series', {
    symbol: tdSymbol,
    interval: '1day',
    outputsize: '5000',
    start_date: '2000-01-01',
    order: 'ASC',
  });

  if (!batch1.values?.length) {
    throw new ServiceError(404, `No data found for ${ticker}`);
  }

  // Company name — best effort (1 extra API call)
  let name: string | null = null;
  try {
    const quote = await tdFetch<TDQuote>('/quote', { symbol: tdSymbol });
    name = quote.name ?? null;
  } catch {
    // Non-fatal
  }

  const { rows: [inserted] } = await db.query<{ id: number }>(
    'INSERT INTO stocks (ticker, name) VALUES ($1, $2) RETURNING id',
    [ticker, name]
  );
  const stockId = inserted.id;

  await insertPriceHistory(stockId, batch1.values);

  // Batch 2 if the first batch was maxed out (more history likely exists)
  if (batch1.values.length === 5000) {
    const lastDate = batch1.values[batch1.values.length - 1].datetime;
    const next = new Date(lastDate);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().slice(0, 10);

    try {
      const batch2 = await tdFetch<TDTimeSeries>('/time_series', {
        symbol: tdSymbol,
        interval: '1day',
        outputsize: '5000',
        start_date: nextStr,
        order: 'ASC',
      });
      if (batch2.values?.length) await insertPriceHistory(stockId, batch2.values);
    } catch {
      // Best-effort
    }
  }

  return selectPriceHistory(stockId);
}

/** Fetches intraday bars live (not cached in DB). Max 59 days back per Twelve Data free plan. */
export async function fetchIntraday(
  ticker: string,
  interval: '1h' | '30min' | '15min'
): Promise<PriceRow[]> {
  const tdSymbol = toTDSymbol(ticker);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 59);

  const data = await tdFetch<TDTimeSeries>('/time_series', {
    symbol: tdSymbol,
    interval,
    outputsize: '5000',
    start_date: startDate.toISOString().slice(0, 10),
    order: 'ASC',
  });

  return (data.values ?? []).map((b) => ({
    date: b.datetime,
    open: parseFloat(b.open),
    high: parseFloat(b.high),
    low: parseFloat(b.low),
    close: parseFloat(b.close),
    volume: parseInt(b.volume, 10) || 0,
  }));
}

/** Returns live quote metadata. marketCap is always null on the free plan. */
export async function fetchStats(ticker: string): Promise<StockStats> {
  const tdSymbol = toTDSymbol(ticker);
  const q = await tdFetch<TDQuote>('/quote', { symbol: tdSymbol });

  return {
    name: q.name ?? ticker,
    exchangeName: q.exchange ?? '',
    currency: q.currency ?? 'USD',
    marketCap: null,
    close: q.close ? parseFloat(q.close) : null,
    open: q.open ? parseFloat(q.open) : null,
    fiftyTwoWeekHigh: q.fifty_two_week?.high ? parseFloat(q.fifty_two_week.high) : null,
    fiftyTwoWeekLow: q.fifty_two_week?.low ? parseFloat(q.fifty_two_week.low) : null,
    volume: q.volume ? parseInt(q.volume, 10) : null,
  };
}

/** Returns up to 8 autocomplete suggestions. Colon-format symbols are filtered out. */
export async function searchTickers(query: string): Promise<Suggestion[]> {
  const data = await tdFetch<TDSearchResult>('/symbol_search', { symbol: query });

  return (data.data ?? [])
    .filter((item) => !item.symbol.includes(':'))
    .filter((item) => item.country === 'United States') // free tier is US-only
    .filter((item, i, arr) => arr.findIndex((x) => x.symbol === item.symbol) === i)
    .slice(0, 8)
    .map((item) => ({
      ticker: item.symbol,
      name: item.instrument_name,
      exchange: item.exchange,
      type: item.instrument_type,
    }));
}

// Marketaux "MM/DD/YYYY HH:MM:SS" → ISO-8601 "YYYY-MM-DDTHH:MM:SSZ"
function toISODate(raw: string): string {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}T${m[4]}Z` : raw;
}

interface MarketauxArticle {
  uuid: string;
  title: string;
  description: string | null;
  snippet: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Analyst recommendations (Finnhub)
// ---------------------------------------------------------------------------

export interface AnalystRecommendation {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

/** Fetches the most recent analyst recommendation consensus from Finnhub. */
export async function fetchRecommendations(ticker: string): Promise<AnalystRecommendation | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new ServiceError(503, 'Finnhub API key not configured');

  const symbol = ticker.split('.')[0];

  const url = new URL('https://finnhub.io/api/v1/stock/recommendation');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('token', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new ServiceError(502, `Finnhub HTTP ${res.status}`);

  const data = (await res.json()) as Array<{
    buy: number;
    hold: number;
    period: string;
    sell: number;
    strongBuy: number;
    strongSell: number;
    symbol: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) return null;

  const avg = (field: keyof typeof data[0]) =>
    Math.round(data.reduce((sum, d) => sum + (d[field] as number), 0) / data.length);

  return {
    period: data[0].period,
    strongBuy:  avg('strongBuy'),
    buy:        avg('buy'),
    hold:       avg('hold'),
    sell:       avg('sell'),
    strongSell: avg('strongSell'),
  };
}

/** Fetches relevant news headlines from Marketaux (symbol-filtered, no extra lookup needed). */
export async function fetchNews(ticker: string): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) throw new ServiceError(503, 'News service not configured (missing NEWS_API_KEY)');

  // Marketaux uses the bare symbol without exchange suffix
  const symbol = ticker.split('.')[0];

  const url = new URL('https://api.marketaux.com/v1/news/all');
  url.searchParams.set('symbols', symbol);
  url.searchParams.set('filter_entities', 'true');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', '10');
  url.searchParams.set('api_token', apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) throw new ServiceError(502, `Marketaux HTTP ${res.status}`);

  const data = (await res.json()) as {
    meta: { found: number; returned: number };
    data?: MarketauxArticle[];
    error?: { code: string; message: string };
  };

  if (data.error) throw new ServiceError(502, data.error.message ?? 'Marketaux error');

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;

  return (data.data ?? [])
    .map((a) => ({
      title: a.title,
      description: a.snippet ?? a.description,
      url: a.url,
      urlToImage: a.image_url,
      source: a.source,
      publishedAt: toISODate(a.published_at),
    }))
    .filter((a) => new Date(a.publishedAt).getTime() >= cutoff);
}

// ---------------------------------------------------------------------------
// News sentiment (OpenAI)
// ---------------------------------------------------------------------------

type SentimentLabel = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface NewsSentiment {
  sentiment: SentimentLabel;
  score: number;
  summary: string;
}

/** Fetches news then enriches articles with sentiment via OpenAI gpt-4o-mini. */
export async function fetchNewsSentiment(ticker: string): Promise<{
  articles: (NewsArticle & { sentiment?: SentimentLabel })[];
  overall: NewsSentiment | null;
}> {
  const articles = await fetchNews(ticker);
  if (articles.length === 0) return { articles, overall: null };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { articles, overall: null };

  try {
    const client = new OpenAI({ apiKey });

    const articleList = articles
      .map((a, i) => `${i + 1}. "${a.title}"${a.description ? ` — ${a.description}` : ''}`)
      .join('\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a financial news sentiment analyst. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: `Analyze the sentiment of these ${ticker} news headlines.\n\n${articleList}\n\nReturn JSON:\n{"overall":{"sentiment":"BULLISH","score":0-100,"summary":"2-3 sentences"},"articles":[{"sentiment":"BULLISH"},...]} where sentiment is one of BULLISH, NEUTRAL, or BEARISH.`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? '';
    const parsed = JSON.parse(raw) as {
      overall: { sentiment: SentimentLabel; score: number; summary: string };
      articles: { sentiment: SentimentLabel }[];
    };

    const enriched = articles.map((a, i) => ({
      ...a,
      sentiment: parsed.articles[i]?.sentiment ?? undefined,
    }));

    return { articles: enriched, overall: parsed.overall };
  } catch (err) {
    console.error('[sentiment] OpenAI error:', err);
    return { articles, overall: null };
  }
}
