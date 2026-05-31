'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import TickerAutocomplete from '@/components/TickerAutocomplete';
import StatsPanel from '@/components/StatsPanel';
import NewsSection from '@/components/NewsSection';
import StockLoader from '@/components/StockLoader';
import AnalystBar from '@/components/AnalystBar';
import QuickAccess from '@/components/QuickAccess';
import IndicatorToggles from '@/components/IndicatorToggles';
import SentimentPanel from '@/components/SentimentPanel';
import ChatPanel from '@/components/ChatPanel';
import { getFromIndex, computeChange, formatChange } from '@/utils/chartUtils';

const RSIChart  = dynamic(() => import('@/components/RSIChart'),  { ssr: false });
const MACDChart = dynamic(() => import('@/components/MACDChart'), { ssr: false });

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

type StockEntry = { ticker: string; name: string };

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}
function saveLS(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Dynamic import required — lightweight-charts accesses the DOM at import time
const StockChart = dynamic(() => import('@/components/StockChart'), { ssr: false });

// ---------------------------------------------------------------------------
// Shared types (exported so child components can import them)
// ---------------------------------------------------------------------------

export type PriceRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
export type Interval  = 'day' | '1h' | '30m' | '15m';
export type ChartStyle = 'candle' | 'line';
export type ThemeMode  = 'dark' | 'light';

export type LiveStats = {
  name: string;
  exchangeName: string;
  currency: string;
  marketCap: null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
};

export type SentimentLabel = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  publishedAt: string;
  sentiment?: SentimentLabel;
};

export type NewsSentiment = {
  sentiment: SentimentLabel;
  score: number;
  summary: string;
};

export type AnalystRecommendation = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export type IndicatorData = {
  sma20?:  { time: string; value: number }[];
  sma50?:  { time: string; value: number }[];
  sma200?: { time: string; value: number }[];
  ema12?:  { time: string; value: number }[];
  ema26?:  { time: string; value: number }[];
  rsi?:    { time: string; value: number }[];
  macd?:   { time: string; macd: number; signal: number; histogram: number }[];
};

const MA_COLORS: Record<string, string> = {
  sma20: '#f59e0b', sma50: '#3b82f6', sma200: '#a855f7', ema12: '#f43f5e', ema26: '#14b8a6',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
const INTERVALS: { value: Interval; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: '1h',  label: '1H'  },
  { value: '30m', label: '30m' },
  { value: '15m', label: '15m' },
];

const INTERVAL_ENDPOINT: Partial<Record<Interval, string>> = {
  '1h': 'hourly', '30m': '30min', '15m': '15min',
};

/** Intraday data covers at most 59 days — disable timeframes longer than 1M for intraday intervals. */
function isTfDisabled(tf: Timeframe, iv: Interval): boolean {
  if (iv === 'day') return false;
  return !(['1D', '5D', '1M'] as Timeframe[]).includes(tf);
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function Page() {
  const [ticker, setTicker]           = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [dailyData, setDailyData]     = useState<PriceRow[]>([]);
  const [intradayCache, setIntradayCache] = useState<Record<string, PriceRow[]>>({});
  const [stats, setStats]             = useState<LiveStats | null>(null);
  const [news, setNews]               = useState<NewsArticle[]>([]);
  const [newsError, setNewsError]     = useState<string | null>(null);
  const [timeframe, setTimeframe]     = useState<Timeframe>('1Y');
  const [interval, setInterval]       = useState<Interval>('day');
  const [chartStyle, setChartStyle]   = useState<ChartStyle>('candle');
  const [theme, setTheme]             = useState<ThemeMode>('dark');
  const [recommendations, setRecommendations] = useState<AnalystRecommendation | null>(null);
  const [indicators,       setIndicators]      = useState<IndicatorData | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [newsSentiment, setNewsSentiment] = useState<NewsSentiment | null>(null);
  const [recent,    setRecent]    = useState<StockEntry[]>([]);
  const [watchlist, setWatchlist] = useState<StockEntry[]>([]);
  const [chatOpen,       setChatOpen]       = useState(false);
  const [activeStockName, setActiveStockName] = useState('');

  // Load persisted lists after mount so server and client render identically
  useEffect(() => {
    setRecent(loadLS('stock-intel:recent', []));
    setWatchlist(loadLS('stock-intel:watchlist', []));
  }, []);
  const [loading, setLoading]         = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [notFound, setNotFound]       = useState(false);

  // Data fed into the chart — daily or intraday depending on interval
  const chartData = useMemo<PriceRow[]>(() => {
    if (interval === 'day') return dailyData;
    return intradayCache[`${activeTicker}:${interval}`] ?? [];
  }, [interval, activeTicker, dailyData, intradayCache]);

  const priceChange = useMemo(() => {
    if (!chartData.length) return null;
    const fromIdx = getFromIndex(chartData, timeframe, interval);
    return computeChange(chartData, fromIdx);
  }, [chartData, timeframe, interval]);

  // ---------------------------------------------------------------------------
  // Load a ticker (price + stats in parallel, news separately so chart shows fast)
  // ---------------------------------------------------------------------------
  const loadStock = useCallback(async (t: string) => {
    const norm = t.trim().toUpperCase();
    if (!norm) return;

    setLoading(true);
    setActiveTicker(norm);
    setActiveStockName('');
    setDailyData([]);
    setStats(null);
    setRecommendations(null);
    setIndicators(null);
    setActiveIndicators([]);
    setIndicatorsLoading(false);
    setNews([]);
    setNewsError(null);
    setNewsSentiment(null);
    setError(null);
    setNotFound(false);
    setIntradayCache({});
    setInterval('day');
    setTimeframe('1Y');

    try {
      const [priceRes, statsRes, recoRes] = await Promise.all([
        fetch(`${API_URL}/api/stocks/${norm}`),
        fetch(`${API_URL}/api/stocks/${norm}/stats`),
        fetch(`${API_URL}/api/stocks/${norm}/recommendations`),
      ]);

      if (!priceRes.ok) {
        const body = await priceRes.json() as { error?: string };
        if (priceRes.status === 404) setNotFound(true);
        throw new Error(body.error ?? `HTTP ${priceRes.status}`);
      }

      const [prices, statsData, recoData] = await Promise.all([
        priceRes.json() as Promise<PriceRow[]>,
        statsRes.ok ? (statsRes.json() as Promise<LiveStats>) : Promise.resolve(null),
        recoRes.ok ? (recoRes.json() as Promise<AnalystRecommendation | null>) : Promise.resolve(null),
      ]);

      setDailyData(prices);
      if (statsData) setStats(statsData);
      if (recoData?.period) setRecommendations(recoData);

      // Track in recent searches (newest first, max 8, deduped)
      const entryName = statsData?.name ?? norm;
      setActiveStockName(entryName);
      setRecent((prev) => {
        const next = [{ ticker: norm, name: entryName }, ...prev.filter((e) => e.ticker !== norm)].slice(0, 8);
        saveLS('stock-intel:recent', next);
        return next;
      });
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load stock data');
    } finally {
      setLoading(false);
    }

    // Indicators — non-blocking, runs in parallel with news
    setIndicatorsLoading(true);
    fetch(`${API_URL}/api/stocks/${norm}/indicators`)
      .then(async (res) => { if (res.ok) setIndicators(await res.json() as IndicatorData); })
      .catch(() => {})
      .finally(() => setIndicatorsLoading(false));

    // News + AI sentiment — non-blocking, load after the chart is already visible
    setNewsLoading(true);
    setNewsError(null);
    try {
      const newsRes = await fetch(`${API_URL}/api/stocks/${norm}/news-sentiment`);
      if (newsRes.ok) {
        const data = await newsRes.json() as { articles: NewsArticle[]; overall: NewsSentiment | null };
        setNews(data.articles);
        if (data.overall) setNewsSentiment(data.overall);
      } else {
        const body = await newsRes.json() as { error?: string };
        setNewsError(body.error ?? `HTTP ${newsRes.status}`);
      }
    } catch {
      setNewsError('Failed to load news');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Indicator helpers
  // ---------------------------------------------------------------------------

  const toggleIndicator = useCallback((key: string) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const maData = useMemo(() => {
    if (!indicators) return [];
    return activeIndicators
      .filter((k) => k in MA_COLORS)
      .map((k) => ({
        key:   k,
        color: MA_COLORS[k],
        data:  (indicators[k as keyof IndicatorData] ?? []) as { time: string; value: number }[],
      }));
  }, [indicators, activeIndicators]);

  // ---------------------------------------------------------------------------
  // Watchlist helpers
  // ---------------------------------------------------------------------------

  const toggleWatchlist = useCallback((ticker: string, name: string) => {
    setWatchlist((prev) => {
      const next = prev.some((e) => e.ticker === ticker)
        ? prev.filter((e) => e.ticker !== ticker)
        : [...prev, { ticker, name }];
      saveLS('stock-intel:watchlist', next);
      return next;
    });
  }, []);

  const removeFromRecent = useCallback((ticker: string) => {
    setRecent((prev) => {
      const next = prev.filter((e) => e.ticker !== ticker);
      saveLS('stock-intel:recent', next);
      return next;
    });
  }, []);

  const removeFromWatchlist = useCallback((ticker: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((e) => e.ticker !== ticker);
      saveLS('stock-intel:watchlist', next);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Interval change — fetch intraday data on demand if not yet cached
  // ---------------------------------------------------------------------------
  const handleIntervalChange = useCallback(async (iv: Interval) => {
    setInterval(iv);

    // Clear MA overlays from the main chart when changing candle size
    setActiveIndicators((prev) => prev.filter((k) => !(k in MA_COLORS)));

    if (iv === 'day' || !activeTicker) return;

    // Clamp timeframe to intraday-compatible values
    if (isTfDisabled(timeframe, iv)) setTimeframe('1M');

    const cacheKey = `${activeTicker}:${iv}`;
    if (intradayCache[cacheKey]) return; // Already in session cache

    const endpoint = INTERVAL_ENDPOINT[iv];
    if (!endpoint) return;

    try {
      const res = await fetch(`${API_URL}/api/stocks/${activeTicker}/${endpoint}`);
      if (res.ok) {
        const data: PriceRow[] = await res.json();
        setIntradayCache((prev) => ({ ...prev, [cacheKey]: data }));
      }
    } catch { /* silent — chart will show empty */ }
  }, [activeTicker, timeframe, intradayCache]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isDark = theme === 'dark';
  const isWatchlisted = watchlist.some((e) => e.ticker === activeTicker);

  function tabCls(active: boolean, disabled = false) {
    if (disabled) return 'px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 dark:text-slate-600 cursor-not-allowed';
    return `px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer
      ${active
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`;
  }

  function styleBtnCls(active: boolean) {
    return `px-3 py-1.5 rounded-md text-sm font-medium transition-colors
      ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark' : ''}`}>
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all duration-300 ease-in-out ${chatOpen ? 'mr-96' : ''}`}>

        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight">Stock Intel</span>
              {activeTicker && (
                <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{activeTicker}</span>
              )}
              {stats?.name && (
                <span className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">— {stats.name}</span>
              )}
            </div>
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800
                         hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">

          {/* Search + chart style */}
          <div className="flex flex-wrap items-center gap-3">
            <form
              onSubmit={(e) => { e.preventDefault(); loadStock(ticker); }}
              className="flex items-center gap-2 flex-1"
            >
              <TickerAutocomplete value={ticker} onChange={setTicker} onSubmit={loadStock} />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                Search
              </button>
            </form>
            <div className="flex gap-1">
              <button className={styleBtnCls(chartStyle === 'candle')} onClick={() => setChartStyle('candle')}>
                Candle
              </button>
              <button className={styleBtnCls(chartStyle === 'line')} onClick={() => setChartStyle('line')}>
                Line
              </button>
            </div>
          </div>

          {/* Recent searches + watchlist */}
          <QuickAccess
            recent={recent}
            watchlist={watchlist}
            activeTicker={activeTicker}
            onSelect={loadStock}
            onRemoveRecent={removeFromRecent}
            onRemoveWatchlist={removeFromWatchlist}
          />

          {/* Timeframe tabs */}
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((tf) => {
              const disabled = isTfDisabled(tf, interval);
              return (
                <button
                  key={tf}
                  disabled={disabled}
                  onClick={() => !disabled && setTimeframe(tf)}
                  className={tabCls(tf === timeframe, disabled)}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {/* Interval tabs */}
          <div className="flex gap-1">
            {INTERVALS.map(({ value: iv, label }) => (
              <button
                key={iv}
                onClick={() => handleIntervalChange(iv)}
                className={tabCls(iv === interval)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Indicator toggles — daily only */}
          {activeTicker && !notFound && interval === 'day' && (
            <IndicatorToggles
              active={activeIndicators}
              loading={indicatorsLoading}
              onToggle={toggleIndicator}
            />
          )}

          {/* Chart area */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex">
              {/* Left: header strip + chart content */}
              <div className="flex-1 min-w-0 flex flex-col">
                {/* Chart header strip — company name + exchange + price change */}
                {activeTicker && !loading && (
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {stats?.name ?? activeTicker}
                    </span>
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                      {stats?.exchangeName ? `(${stats.exchangeName}/${activeTicker})` : activeTicker}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <button
                        onClick={() => toggleWatchlist(activeTicker, stats?.name ?? activeTicker)}
                        aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                        title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                        className={`text-base leading-none transition-colors ${isWatchlisted ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-amber-400 dark:text-slate-500 dark:hover:text-amber-400'}`}
                      >
                        {isWatchlisted ? '★' : '☆'}
                      </button>
                      {priceChange && (
                        <span className={`font-mono text-xs font-semibold ${priceChange.abs >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatChange(priceChange, stats?.currency ?? 'USD')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {loading ? (
                  <StockLoader />
                ) : notFound ? (
                  <div className="h-96 flex flex-col items-center justify-center gap-5 text-center px-8">
                    <div className="w-14 h-14 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 flex items-center justify-center">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        className="text-amber-500">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <div className="space-y-2 max-w-xs">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {activeTicker} isn&apos;t available
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                        Not supported yet. Try a US market stock -{' '}
                        {['AAPL', 'MSFT', 'NVDA', 'TSLA'].map((t, i, arr) => (
                          <span key={t}>
                            <button
                              onClick={() => { setTicker(t); loadStock(t); }}
                              className="font-medium text-blue-500 hover:text-blue-400 transition-colors"
                            >{t}</button>
                            {i < arr.length - 1 ? ', ' : '.'}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="h-96 flex items-center justify-center text-red-500 text-sm">{error}</div>
                ) : chartData.length > 0 ? (
                  <div className="p-2">
                    <StockChart
                      data={chartData}
                      timeframe={timeframe}
                      interval={interval}
                      chartStyle={chartStyle}
                      theme={theme}
                      maData={maData}
                    />
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400 dark:text-slate-600">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    <span className="text-xs font-mono">Search a ticker to view its full price history.</span>
                  </div>
                )}
              </div>

              {/* Right: analyst ratings bar */}
              {recommendations && chartData.length > 0 && !loading && (
                <AnalystBar
                  strongBuy={recommendations.strongBuy}
                  buy={recommendations.buy}
                  hold={recommendations.hold}
                  sell={recommendations.sell}
                  strongSell={recommendations.strongSell}
                  period={recommendations.period}
                />
              )}
            </div>
          </div>

          {/* RSI sub-panel */}
          {activeIndicators.includes('rsi') && indicators?.rsi && indicators.rsi.length > 0 && (
            <RSIChart
              data={indicators.rsi}
              priceData={dailyData}
              timeframe={timeframe}
              interval={interval}
              theme={theme}
            />
          )}

          {/* MACD sub-panel */}
          {activeIndicators.includes('macd') && indicators?.macd && indicators.macd.length > 0 && (
            <MACDChart
              data={indicators.macd}
              priceData={dailyData}
              timeframe={timeframe}
              interval={interval}
              theme={theme}
            />
          )}

          {/* Stats panel */}
          {(stats || dailyData.length > 0) && (
            <StatsPanel
              data={dailyData}
              stats={stats}
              timeframe={timeframe}
              interval={interval}
            />
          )}

          {/* News + AI sentiment — hidden when stock is not available */}
          {activeTicker && !notFound && (
            <>
              <SentimentPanel sentiment={newsSentiment} loading={newsLoading} />
              <NewsSection
                articles={news}
                loading={newsLoading}
                error={newsError}
              />
            </>
          )}

        </main>
      </div>

      {/* Floating chat button */}
      {activeTicker && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2
                     rounded-full px-4 py-3 shadow-lg bg-blue-600 text-white
                     hover:bg-blue-500 transition-colors text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Ask about {activeTicker}
        </button>
      )}

      {/* Chat side panel */}
      {activeTicker && (
        <ChatPanel
          ticker={activeTicker}
          stockName={activeStockName}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
