import { db } from '../db/client';
import { buildFilterTerms, extractSearchQuery, filterRelevantNews } from './newsUtils';

const TD_KEY   = process.env.TWELVE_DATA_API_KEY ?? '';
const NEWS_KEY = process.env.NEWS_API_KEY ?? '';
const TD_BASE  = 'https://api.twelvedata.com';
const NEWS_BASE = 'https://newsapi.org/v2';

export interface PriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const HISTORY_START = '2000-01-01';

// ── Ticker format translation ─────────────────────────────────────────────────
// Yahoo Finance uses dot suffixes (ESLT.TA); Twelve Data uses colon (ESLT:TASE).
const EXCHANGE_MAP: Record<string, string> = {
  TA: 'TASE',
  L:  'LSE',
  TO: 'TSX',
  AX: 'ASX',
  HK: 'HKEX',
  PA: 'EURONEXT',
  DE: 'XETRA',
  SW: 'SIX',
  MI: 'MIL',
};

function toTDSymbol(ticker: string): string {
  const dot = ticker.indexOf('.');
  if (dot < 0) return ticker;
  const base   = ticker.slice(0, dot);
  const suffix = ticker.slice(dot + 1).toUpperCase();
  const exch   = EXCHANGE_MAP[suffix];
  return exch ? `${base}:${exch}` : ticker;
}

// ── Twelve Data response types ────────────────────────────────────────────────
interface TDBar {
  datetime: string;   // "YYYY-MM-DD" daily | "YYYY-MM-DD HH:mm:ss" intraday
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TDTimeSeriesResponse {
  status?: string;
  message?: string;
  values?: TDBar[];
}

interface TDQuoteResponse {
  status?: string;
  message?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  volume?: string;
  fifty_two_week?: { high?: string; low?: string };
}

interface TDSearchItem {
  symbol: string;
  instrument_name: string;
  exchange: string;
  country: string;
  instrument_type: string;
}

// ── Twelve Data fetch helper ──────────────────────────────────────────────────
async function tdFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ ...params, apikey: TD_KEY });
  const res = await fetch(`${TD_BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  return res.json();
}

/** Fetch a page of OHLCV bars. Returns up to 5 000 bars ordered ASC by date. */
async function fetchTDBars(
  ticker: string,
  interval: string,
  startDate: string,
  endDate?: string,
): Promise<TDBar[]> {
  const params: Record<string, string> = {
    symbol:     toTDSymbol(ticker),
    interval,
    start_date: startDate,
    outputsize: '5000',
    order:      'ASC',
  };
  if (endDate) params.end_date = endDate;

  const data = await tdFetch('/time_series', params) as TDTimeSeriesResponse;
  if (data.status === 'error') throw new Error(data.message ?? 'Twelve Data error');
  return data.values ?? [];
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function insertBars(stockId: number, bars: TDBar[]): Promise<void> {
  const valid = bars.filter(b => b.open && b.close);
  if (valid.length === 0) return;

  const params: unknown[] = [];
  const placeholders = valid.map((b, i) => {
    const base = i * 7;
    params.push(
      stockId,
      new Date(b.datetime),
      parseFloat(b.open),
      b.high   ? parseFloat(b.high)   : null,
      b.low    ? parseFloat(b.low)    : null,
      parseFloat(b.close),
      b.volume ? parseInt(b.volume, 10) : 0,
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`;
  });

  await db.query(
    `INSERT INTO price_history (stock_id, date, open, high, low, close, volume)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (stock_id, date) DO NOTHING`,
    params,
  );
}

// ── History management ────────────────────────────────────────────────────────
// Same 2-year heuristic as before: if the oldest cached row predates 2 years
// ago, the full backfill has already run.
async function ensureFullHistory(stockId: number, ticker: string): Promise<void> {
  const { rows } = await db.query(
    'SELECT MIN(date) AS oldest FROM price_history WHERE stock_id = $1',
    [stockId],
  );
  const oldest: Date | null = rows[0].oldest;
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  if (oldest && oldest <= twoYearsAgo) return; // already deep enough

  const fetchUntil = oldest
    ? oldest.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const bars = await fetchTDBars(ticker, '1day', HISTORY_START, fetchUntil);
  await insertBars(stockId, bars);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getOrFetchStock(ticker: string): Promise<PriceRow[]> {
  const upper = ticker.toUpperCase();
  const existing = await db.query('SELECT id FROM stocks WHERE ticker = $1', [upper]);

  if (existing.rows.length > 0) {
    const stockId: number = existing.rows[0].id;
    await ensureFullHistory(stockId, upper);
    return getPriceHistory(stockId);
  }

  // New ticker — fetch history in up to two batches (5 000 bars ≈ 19 yrs each)
  const batch1 = await fetchTDBars(upper, '1day', HISTORY_START);
  let batch2: TDBar[] = [];
  if (batch1.length === 5000) {
    const lastDate = new Date(batch1[batch1.length - 1].datetime);
    lastDate.setDate(lastDate.getDate() + 1);
    batch2 = await fetchTDBars(upper, '1day', lastDate.toISOString().split('T')[0]);
  }

  // Best-effort company name from quote endpoint
  let companyName: string | null = null;
  try {
    const q = await tdFetch('/quote', { symbol: toTDSymbol(upper) }) as TDQuoteResponse;
    companyName = q.name ?? null;
  } catch { /* not fatal */ }

  const { rows } = await db.query(
    'INSERT INTO stocks (ticker, name) VALUES ($1, $2) RETURNING id',
    [upper, companyName ?? upper],
  );
  const stockId: number = rows[0].id;
  await insertBars(stockId, [...batch1, ...batch2]);

  return getPriceHistory(stockId);
}

async function fetchIntraday(
  ticker: string,
  interval: '1h' | '30min' | '15min',
  daysBack: number,
): Promise<PriceRow[]> {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const startDate = from.toISOString().split('T')[0];

  const bars = await fetchTDBars(ticker.toUpperCase(), interval, startDate);

  return bars
    .filter(b => b.open && b.close)
    .map(b => ({
      date:   new Date(b.datetime).toISOString(),
      open:   parseFloat(b.open),
      high:   b.high  ? parseFloat(b.high)  : parseFloat(b.open),
      low:    b.low   ? parseFloat(b.low)   : parseFloat(b.open),
      close:  parseFloat(b.close),
      volume: b.volume ? parseInt(b.volume, 10) : 0,
    }));
}

export const getHourlyData = (ticker: string) => fetchIntraday(ticker, '1h',    59);
export const get30MinData  = (ticker: string) => fetchIntraday(ticker, '30min', 59);
export const get15MinData  = (ticker: string) => fetchIntraday(ticker, '15min', 59);

// ── Stock stats ───────────────────────────────────────────────────────────────

export interface StockStats {
  name:             string | null;
  exchangeName:     string | null;
  currency:         string | null;
  marketCap:        number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow:  number | null;
  volume:           number | null;
}

export function normalizeExchange(exchange: string | null | undefined): string | null {
  if (!exchange) return null;
  const upper = exchange.toUpperCase();
  if (upper.includes('NASDAQ')) return 'Nasdaq';
  if (upper.includes('NYSE'))   return 'NYSE';
  return exchange;
}

export async function getStockStats(ticker: string): Promise<StockStats> {
  const data = await tdFetch('/quote', { symbol: toTDSymbol(ticker.toUpperCase()) }) as TDQuoteResponse;
  if ((data as TDQuoteResponse).status === 'error') {
    throw new Error((data as TDQuoteResponse).message ?? 'Quote error');
  }

  return {
    name:             data.name              ?? null,
    exchangeName:     normalizeExchange(data.exchange),
    currency:         data.currency          ?? null,
    marketCap:        null,   // not available on Twelve Data free plan
    fiftyTwoWeekHigh: data.fifty_two_week?.high ? parseFloat(data.fifty_two_week.high) : null,
    fiftyTwoWeekLow:  data.fifty_two_week?.low  ? parseFloat(data.fifty_two_week.low)  : null,
    volume:           data.volume ? parseInt(data.volume, 10) : null,
  };
}

// ── News ──────────────────────────────────────────────────────────────────────

export interface NewsArticle {
  title:       string;
  publisher:   string;
  link:        string;
  publishedAt: string;   // ISO string
  imageUrl:    string | null;
}

export async function getStockNews(ticker: string): Promise<NewsArticle[]> {
  const upper = ticker.toUpperCase();

  // Best-effort company name for richer search query
  let companyName: string | null = null;
  try {
    const q = await tdFetch('/quote', { symbol: toTDSymbol(upper) }) as TDQuoteResponse;
    companyName = q.name ?? null;
  } catch { /* proceed with ticker only */ }

  const filterTerms = buildFilterTerms(upper, companyName);

  // Build NewsAPI query: combine ticker + extracted company name
  const nameQuery  = companyName ? extractSearchQuery(companyName) : null;
  const searchQ    = nameQuery && nameQuery.toUpperCase() !== upper
    ? `${upper} OR "${nameQuery}"`
    : upper;

  const qs = new URLSearchParams({
    q:        searchQ,
    language: 'en',
    sortBy:   'publishedAt',
    pageSize: '20',
    apiKey:   NEWS_KEY,
  });

  interface NewsAPIArticle {
    title: string;
    source: { name: string };
    url: string;
    publishedAt: string;
    urlToImage: string | null;
  }

  let pool: NewsArticle[] = [];
  try {
    const res  = await fetch(`${NEWS_BASE}/everything?${qs}`);
    const data = await res.json() as { articles?: NewsAPIArticle[] };
    pool = (data.articles ?? []).map(a => ({
      title:       a.title,
      publisher:   a.source.name,
      link:        a.url,
      publishedAt: a.publishedAt,
      imageUrl:    a.urlToImage ?? null,
    }));
  } catch { /* return empty on network error */ }

  // minRelevant = 0: never fall back to unrelated noise
  const relevant = filterRelevantNews(pool, filterTerms, 0);
  return relevant.slice(0, 10);
}

// ── Ticker search (autocomplete) ──────────────────────────────────────────────

export interface SearchResult {
  ticker:   string;
  name:     string | null;
  exchange: string | null;
  type:     string | null;
}

export async function searchTickers(query: string): Promise<SearchResult[]> {
  const data = await tdFetch('/symbol_search', { symbol: query, outputsize: '8' }) as {
    status?: string;
    data?: TDSearchItem[];
  };
  if (data.status === 'error' || !data.data) return [];

  return data.data
    .filter(r => r.instrument_type === 'Common Stock' || r.instrument_type === 'ETF')
    .slice(0, 8)
    .map(r => ({
      ticker:   r.symbol,
      name:     r.instrument_name ?? null,
      exchange: r.exchange        ?? null,
      type:     r.instrument_type ?? null,
    }));
}

// ── DB serialisation ──────────────────────────────────────────────────────────

export function dbRowToPriceRow(r: Record<string, unknown>): PriceRow {
  return {
    date:   (r.date as Date).toISOString().split('T')[0],
    open:   parseFloat(r.open  as string),
    high:   parseFloat(r.high  as string),
    low:    parseFloat(r.low   as string),
    close:  parseFloat(r.close as string),
    volume: parseInt(r.volume  as string, 10),
  };
}

async function getPriceHistory(stockId: number): Promise<PriceRow[]> {
  const result = await db.query(
    `SELECT date, open, high, low, close, volume
     FROM price_history WHERE stock_id = $1 ORDER BY date ASC`,
    [stockId],
  );
  return result.rows.map(dbRowToPriceRow);
}
