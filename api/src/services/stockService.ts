import YahooFinance from 'yahoo-finance2';
import { db } from '../db/client';
import { buildFilterTerms, extractSearchQuery, filterRelevantNews, isTitleRelevant } from './newsUtils';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface PriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const HISTORY_START = new Date('2000-01-01');

interface Quote {
  date: Date;
  open:   number | null;
  high:   number | null;
  low:    number | null;
  close:  number | null;
  volume: number | null;
}

async function insertQuotes(stockId: number, quotes: Quote[]) {
  const valid = quotes.filter((q): q is Quote & { open: number; close: number } =>
    q.open != null && q.close != null
  );
  if (valid.length === 0) return;

  const params: unknown[] = [];
  const placeholders = valid.map((q, i) => {
    const b = i * 7;
    params.push(stockId, q.date, q.open, q.high, q.low, q.close, q.volume ?? 0);
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7})`;
  });

  await db.query(
    `INSERT INTO price_history (stock_id, date, open, high, low, close, volume)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (stock_id, date) DO NOTHING`,
    params
  );
}

// 2-year cutoff heuristic: if the oldest row predates 2 years ago the full
// backfill to HISTORY_START has already run. Otherwise backfill now.
async function ensureFullHistory(stockId: number, ticker: string): Promise<void> {
  const { rows } = await db.query(
    'SELECT MIN(date) AS oldest FROM price_history WHERE stock_id = $1',
    [stockId]
  );
  const oldest: Date | null = rows[0].oldest;
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  if (oldest && oldest <= twoYearsAgo) return; // history is already deep enough

  const fetchUntil = oldest ?? new Date();
  const result = await yahooFinance.chart(ticker, {
    period1: HISTORY_START,
    period2: fetchUntil,
    interval: '1d',
  });
  await insertQuotes(stockId, result.quotes);
}

export async function getOrFetchStock(ticker: string): Promise<PriceRow[]> {
  const upper = ticker.toUpperCase();
  const existing = await db.query('SELECT id FROM stocks WHERE ticker = $1', [upper]);

  if (existing.rows.length > 0) {
    const stockId: number = existing.rows[0].id;
    await ensureFullHistory(stockId, upper);
    return getPriceHistory(stockId);
  }

  const result = await yahooFinance.chart(upper, {
    period1: HISTORY_START,
    period2: new Date(),
    interval: '1d',
  });

  const stockInsert = await db.query(
    'INSERT INTO stocks (ticker, name) VALUES ($1, $2) RETURNING id',
    [upper, result.meta.longName ?? upper]
  );
  const stockId: number = stockInsert.rows[0].id;
  await insertQuotes(stockId, result.quotes);

  return getPriceHistory(stockId);
}

async function fetchIntraday(ticker: string, interval: '1h' | '30m' | '15m' | '1m', daysBack: number): Promise<PriceRow[]> {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);

  const result = await yahooFinance.chart(ticker.toUpperCase(), {
    period1: from,
    period2: new Date(),
    interval,
  });

  return result.quotes
    .filter((q) => q.open != null && q.close != null)
    .map((q) => ({
      date: q.date.toISOString(),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: q.volume ?? 0,
    }));
}

export const getHourlyData = (ticker: string) => fetchIntraday(ticker, '1h',  59);
export const get30MinData  = (ticker: string) => fetchIntraday(ticker, '30m', 59);
export const get15MinData  = (ticker: string) => fetchIntraday(ticker, '15m', 59);

export interface StockStats {
  name:             string | null;
  exchangeName:     string | null;
  currency:         string | null;
  marketCap:        number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow:  number | null;
  volume:           number | null;
}

export function normalizeExchange(
  fullName: string | null | undefined,
  exchangeCode: string | null | undefined,
): string | null {
  if (fullName) {
    if (fullName.toLowerCase().includes('nasdaq')) return 'Nasdaq';
    if (fullName.toLowerCase().includes('nyse'))   return 'NYSE';
    return fullName;
  }
  return exchangeCode ?? null;
}

export async function getStockStats(ticker: string): Promise<StockStats> {
  const q = await yahooFinance.quote(ticker.toUpperCase());
  return {
    name:             q.longName ?? q.shortName   ?? null,
    exchangeName:     normalizeExchange(q.fullExchangeName, q.exchange),
    currency:         q.currency                  ?? null,
    marketCap:        q.marketCap                 ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh          ?? null,
    fiftyTwoWeekLow:  q.fiftyTwoWeekLow           ?? null,
    volume:           q.regularMarketVolume        ?? null,
  };
}

export interface NewsArticle {
  title:       string;
  publisher:   string;
  link:        string;
  publishedAt: string;   // ISO string
  imageUrl:    string | null;
}

function toNewsArticle(item: {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: unknown;
  thumbnail?: { resolutions?: unknown };
}): NewsArticle {
  const resolutions =
    item.thumbnail && Array.isArray((item.thumbnail as { resolutions?: unknown }).resolutions)
      ? ((item.thumbnail as { resolutions: Array<{ url: string; width: number }> }).resolutions)
      : [];
  const best = resolutions.slice().sort((a, b) => b.width - a.width)[0] ?? null;
  return {
    title:       item.title,
    publisher:   item.publisher,
    link:        item.link,
    publishedAt: (item.providerPublishTime as Date).toISOString(),
    imageUrl:    best?.url ?? null,
  };
}

export async function getStockNews(ticker: string): Promise<NewsArticle[]> {
  const upper = ticker.toUpperCase();

  // Resolve company name for filtering and fallback search (best-effort)
  let companyName: string | null = null;
  try {
    const q = await yahooFinance.quote(upper);
    companyName = q.shortName ?? q.longName ?? null;
  } catch { /* proceed with ticker-only */ }

  const filterTerms = buildFilterTerms(upper, companyName);

  // ── Pass 1: search by ticker symbol ──────────────────────────────────────
  const primary = await yahooFinance.search(upper, { newsCount: 20, quotesCount: 0 });
  let pool = [...primary.news];

  // ── Pass 2: if ticker search is too noisy, also search by company name ───
  // This is the key fix for foreign/small-cap tickers (e.g. ELAL.TA, ESLT.TA)
  // where Yahoo's keyword index doesn't map the ticker to the right news feed.
  const primaryHits = pool.filter((a) => isTitleRelevant(a.title, filterTerms));
  if (primaryHits.length < 4 && companyName) {
    const nameQuery = extractSearchQuery(companyName);
    if (nameQuery && nameQuery.toUpperCase() !== upper) {
      try {
        const secondary = await yahooFinance.search(nameQuery, { newsCount: 20, quotesCount: 0 });
        // Merge, deduplicating by exact title
        const seen = new Set(pool.map((a) => a.title));
        for (const item of secondary.news) {
          if (!seen.has(item.title)) { pool.push(item); seen.add(item.title); }
        }
      } catch { /* secondary search is best-effort */ }
    }
  }

  // minRelevant = 0 disables the fallback — we never want to return unrelated
  // market noise. The frontend already handles an empty array gracefully.
  const relevant = filterRelevantNews(pool, filterTerms, 0);
  return relevant.slice(0, 10).map(toNewsArticle);
}

export interface SearchResult {
  ticker:   string;
  name:     string | null;
  exchange: string | null;
  type:     string | null;
}

export async function searchTickers(query: string): Promise<SearchResult[]> {
  const result = await yahooFinance.search(query, { newsCount: 0 });
  return result.quotes
    .filter((q) => (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && typeof q.symbol === 'string')
    .slice(0, 8)
    .map((q) => {
      const name =
        ('longname'  in q && typeof q.longname  === 'string' ? q.longname  : null) ??
        ('shortname' in q && typeof q.shortname === 'string' ? q.shortname : null) ??
        null;
      const exchange =
        ('exchDisp' in q && typeof q.exchDisp === 'string' ? q.exchDisp : null) ?? null;
      return { ticker: q.symbol as string, name, exchange, type: (q.quoteType as string) ?? null };
    });
}

export function dbRowToPriceRow(r: Record<string, unknown>): PriceRow {
  return {
    date:   (r.date as Date).toISOString().split('T')[0],
    open:   parseFloat(r.open as string),
    high:   parseFloat(r.high as string),
    low:    parseFloat(r.low  as string),
    close:  parseFloat(r.close as string),
    volume: parseInt(r.volume as string, 10),
  };
}

async function getPriceHistory(stockId: number): Promise<PriceRow[]> {
  const result = await db.query(
    `SELECT date, open, high, low, close, volume
     FROM price_history WHERE stock_id = $1 ORDER BY date ASC`,
    [stockId]
  );
  return result.rows.map(dbRowToPriceRow);
}
