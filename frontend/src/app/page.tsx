'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import StatsPanel, { LiveStats } from '../components/StatsPanel';
import TickerAutocomplete from '../components/TickerAutocomplete';

const StockChart = dynamic(() => import('../components/StockChart'), { ssr: false });

export type Timeframe  = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
export type Interval   = 'day' | 'hour' | '30m' | '15m';
export type ChartStyle = 'candle' | 'line';
export type ThemeMode  = 'dark' | 'light';

export interface PriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1D',  value: '1D'  },
  { label: '5D',  value: '5D'  },
  { label: '1M',  value: '1M'  },
  { label: '3M',  value: '3M'  },
  { label: '6M',  value: '6M'  },
  { label: 'YTD', value: 'YTD' },
  { label: '1Y',  value: '1Y'  },
  { label: 'All', value: 'ALL' },
];

const INTERVALS: { label: string; value: Interval }[] = [
  { label: 'Day',  value: 'day'  },
  { label: '1h',   value: 'hour' },
  { label: '30m',  value: '30m'  },
  { label: '15m',  value: '15m'  },
];

const INTERVAL_ENDPOINT: Record<Interval, string> = {
  day: '', hour: '/hourly', '30m': '/30min', '15m': '/15min',
};

const TIMEFRAME_ORDER: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
const MAX_TIMEFRAME: Record<Interval, Timeframe> = {
  day: 'ALL', hour: '1M', '30m': '1M', '15m': '1M',
};

export function isTfDisabled(tf: Timeframe, iv: Interval): boolean {
  return TIMEFRAME_ORDER.indexOf(tf) > TIMEFRAME_ORDER.indexOf(MAX_TIMEFRAME[iv]);
}

// ── Theme tokens ────────────────────────────────────────────────────────
const T = {
  dark: {
    page:        'bg-slate-900 text-slate-100',
    subtitle:    'text-slate-400',
    label:       'text-slate-500',
    input:       'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:ring-blue-500',
    btnPrimary:  'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50',
    btnActive:   'bg-blue-600 text-white',
    btnActive2:  'bg-indigo-600 text-white',
    btnInactive: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
    btnDisabled: 'bg-slate-800/40 text-slate-600 cursor-not-allowed',
    toggle:      'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border-slate-700',
    error:       'text-red-400',
    spinner:     'text-slate-400',
  },
  light: {
    page:        'bg-slate-50 text-slate-900',
    subtitle:    'text-slate-500',
    label:       'text-slate-400',
    input:       'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-blue-500',
    btnPrimary:  'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50',
    btnActive:   'bg-blue-600 text-white',
    btnActive2:  'bg-indigo-600 text-white',
    btnInactive: 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-slate-200',
    btnDisabled: 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-100',
    toggle:      'bg-white text-slate-600 hover:bg-slate-100 border-slate-300',
    error:       'text-red-600',
    spinner:     'text-slate-500',
  },
};

interface IntradayCache { [key: string]: PriceRow[] }

export default function Home() {
  const [ticker, setTicker]               = useState('');
  const [activeTicker, setActiveTicker]   = useState('');
  const [dailyData, setDailyData]         = useState<PriceRow[]>([]);
  const [stats, setStats]                 = useState<LiveStats | null>(null);
  const [intradayCache, setIntradayCache] = useState<IntradayCache>({});
  const [timeframe, setTimeframe]         = useState<Timeframe>('6M');
  const [interval, setInterval]           = useState<Interval>('day');
  const [chartStyle, setChartStyle]       = useState<ChartStyle>('candle');
  const [loading, setLoading]             = useState(false);
  const [loadingIntraday, setLoadingIntraday] = useState(false);
  const [error, setError]                 = useState('');
  const [theme, setTheme]                 = useState<ThemeMode>('dark');

  const t        = T[theme];
  const cacheKey = `${activeTicker}:${interval}`;

  function handleIntervalChange(iv: Interval) {
    setInterval(iv);
    if (isTfDisabled(timeframe, iv)) setTimeframe(MAX_TIMEFRAME[iv]);
  }

  // Lazy-fetch intraday data
  useEffect(() => {
    if (interval === 'day' || !activeTicker) return;
    if (intradayCache[cacheKey]) return;
    (async () => {
      setLoadingIntraday(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/stocks/${activeTicker}${INTERVAL_ENDPOINT[interval]}`);
        if (!res.ok) throw new Error((await res.json()).error ?? 'Request failed');
        const rows: PriceRow[] = await res.json();
        setIntradayCache((prev) => ({ ...prev, [cacheKey]: rows }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        setLoadingIntraday(false);
      }
    })();
  }, [interval, activeTicker, cacheKey, intradayCache]);

  async function handleSearch(overrideSym?: string) {
    const sym = (overrideSym ?? ticker).trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError('');
    setDailyData([]);
    setStats(null);
    setIntradayCache({});
    setTimeframe('6M');
    setInterval('day');
    try {
      const [priceRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/stocks/${sym}`),
        fetch(`${API_BASE}/api/stocks/${sym}/stats`),
      ]);
      if (!priceRes.ok) throw new Error((await priceRes.json()).error ?? 'Request failed');
      const [priceJson, statsJson] = await Promise.all([
        priceRes.json() as Promise<PriceRow[]>,
        statsRes.ok ? (statsRes.json() as Promise<LiveStats>) : Promise.resolve(null),
      ]);
      setDailyData(priceJson);
      setStats(statsJson);
      setActiveTicker(sym);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const chartData   = interval === 'day' ? dailyData : (intradayCache[cacheKey] ?? []);
  const showChart   = dailyData.length > 0;
  const showSpinner = interval !== 'day' && loadingIntraday;

  return (
    <main className={`min-h-screen p-8 transition-colors ${t.page}`}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Intelligence</h1>
            <p className={`mt-1 ${t.subtitle}`}>Search a ticker to view its full price history</p>
          </div>
          <button
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${t.toggle}`}
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex gap-3"
        >
          <TickerAutocomplete
            value={ticker}
            onChange={setTicker}
            onSelect={(sym) => handleSearch(sym)}
            theme={theme}
            inputClassName={`rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 uppercase ${t.input}`}
            placeholder="e.g. AAPL"
          />
          <button type="submit" disabled={loading} className={`rounded-lg px-5 py-2 font-medium transition-colors ${t.btnPrimary}`}>
            {loading ? 'Loading…' : 'Search'}
          </button>
        </form>

        {error && <p className={`text-sm ${t.error}`}>{error}</p>}

        {showChart && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-6 flex-wrap">
              {/* Candle size */}
              <div className="flex items-center gap-2">
                <span className={`text-xs uppercase tracking-wider ${t.label}`}>Candle</span>
                <div className="flex gap-1">
                  {INTERVALS.map((iv) => (
                    <button
                      key={iv.value}
                      onClick={() => handleIntervalChange(iv.value)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        interval === iv.value ? t.btnActive2 : t.btnInactive
                      }`}
                    >
                      {iv.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe window */}
              <div className="flex items-center gap-2">
                <span className={`text-xs uppercase tracking-wider ${t.label}`}>Window</span>
                <div className="flex gap-1">
                  {TIMEFRAMES.map((tf) => {
                    const disabled = isTfDisabled(tf.value, interval);
                    return (
                      <button
                        key={tf.value}
                        onClick={() => !disabled && setTimeframe(tf.value)}
                        disabled={disabled}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          disabled ? t.btnDisabled : timeframe === tf.value ? t.btnActive : t.btnInactive
                        }`}
                      >
                        {tf.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chart style */}
              <div className="flex items-center gap-2">
                <span className={`text-xs uppercase tracking-wider ${t.label}`}>Style</span>
                <div className="flex gap-1">
                  {(['candle', 'line'] as ChartStyle[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setChartStyle(s)}
                      className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${
                        chartStyle === s ? t.btnActive2 : t.btnInactive
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            {showSpinner ? (
              <div className={`flex items-center justify-center h-40 text-sm ${t.spinner}`}>
                Loading {interval} data...
              </div>
            ) : (
              <StockChart
                data={chartData}
                ticker={activeTicker}
                companyName={stats?.name ?? null}
                exchangeName={stats?.exchangeName ?? null}
                currency={stats?.currency ?? null}
                timeframe={timeframe}
                interval={interval}
                chartStyle={chartStyle}
                theme={theme}
              />
            )}

            {/* Stats */}
            <StatsPanel dailyData={dailyData} stats={stats} theme={theme} />
          </div>
        )}
      </div>
    </main>
  );
}
