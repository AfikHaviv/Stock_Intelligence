'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  CandlestickData,
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { PriceRow, Timeframe, Interval, ChartStyle, ThemeMode } from '../app/page';
import {
  isIntraday, toTimestamp, getFromIndex, computeChange, formatChange,
} from '../utils/chartUtils';

interface Props {
  data: PriceRow[];
  ticker: string;
  companyName:  string | null;
  exchangeName: string | null;
  currency:     string | null;
  timeframe: Timeframe;
  interval: Interval;
  chartStyle: ChartStyle;
  theme: ThemeMode;
}

const COLOR_UP   = '#22c55e';
const COLOR_DOWN = '#ef4444';

const CHART_COLORS = {
  dark:  { bg: '#0f172a', text: '#94a3b8', grid: '#1e293b', border: '#334155' },
  light: { bg: '#ffffff', text: '#475569', grid: '#f1f5f9', border: '#e2e8f0' },
};

const HEADER = {
  dark:  { wrap: 'bg-slate-800',  title: 'text-slate-100', sub: 'text-slate-500', meta: 'text-slate-400' },
  light: { wrap: 'bg-slate-100',  title: 'text-slate-900', sub: 'text-slate-400', meta: 'text-slate-500' },
};

function fmtDate(isoOrDate: string, intraday: boolean): string {
  const d = new Date(isoOrDate);
  if (intraday) {
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

export default function StockChart({ data, ticker, companyName, exchangeName, currency, timeframe, interval, chartStyle, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null);
  const volumeRef    = useRef<ISeriesApi<'Histogram'> | null>(null);
  const dataMapRef   = useRef<Map<number | string, PriceRow>>(new Map());
  const themeRef     = useRef(theme);
  themeRef.current   = theme;

  const [change, setChange] = useState<{ abs: number; pct: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Build time → row lookup for crosshair handler
    const dataMap = new Map<number | string, PriceRow>();
    data.forEach((r) => {
      const key = isIntraday(interval) ? toTimestamp(r.date) : r.date;
      dataMap.set(key, r);
    });
    dataMapRef.current = dataMap;

    const c = CHART_COLORS[themeRef.current];
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: { background: { color: c.bg }, textColor: c.text },
      grid:   { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      timeScale: { borderColor: c.border, timeVisible: isIntraday(interval), secondsVisible: false },
    });
    chartRef.current = chart;

    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.25 },
    });

    const fromIdx = getFromIndex(data, timeframe, interval);
    const ch = computeChange(data, fromIdx);
    setChange(ch);
    const isUp = (ch?.abs ?? 0) >= 0;

    // ── Price series ──────────────────────────────────────────────────────────
    if (chartStyle === 'line') {
      const color = isUp ? COLOR_UP : COLOR_DOWN;
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
        bottomColor: isUp ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.02)',
        lineWidth: 2,
      });
      const lineData = isIntraday(interval)
        ? data.map((r) => ({ time: toTimestamp(r.date) as Time, value: r.close }))
        : data.map((r) => ({ time: r.date as Time, value: r.close }));
      series.setData(lineData);
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: COLOR_UP, downColor: COLOR_DOWN,
        borderUpColor: COLOR_UP, borderDownColor: COLOR_DOWN,
        wickUpColor: COLOR_UP, wickDownColor: COLOR_DOWN,
      });
      const candleData: CandlestickData[] = isIntraday(interval)
        ? data.map((r) => ({ time: toTimestamp(r.date) as Time, open: r.open, high: r.high, low: r.low, close: r.close }))
        : data.map((r) => ({ time: r.date as Time, open: r.open, high: r.high, low: r.low, close: r.close }));
      series.setData(candleData);
      seriesRef.current = series;
    }

    // ── Volume histogram ──────────────────────────────────────────────────────
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volSeries.setData(
      isIntraday(interval)
        ? data.map((r) => ({
            time:  toTimestamp(r.date) as Time,
            value: r.volume,
            color: r.close >= r.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
          }))
        : data.map((r) => ({
            time:  r.date as Time,
            value: r.volume,
            color: r.close >= r.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
          }))
    );
    volumeRef.current = volSeries;

    chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: data.length - 1 });

    // ── Crosshair tooltip ─────────────────────────────────────────────────────
    chart.subscribeCrosshairMove((param) => {
      const el  = tooltipRef.current;
      const box = containerRef.current;
      if (!el || !box) return;

      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        el.style.display = 'none';
        return;
      }

      const row = dataMapRef.current.get(param.time as number | string);
      if (!row) { el.style.display = 'none'; return; }

      const up   = row.close >= row.open;
      const clr  = up ? COLOR_UP : COLOR_DOWN;
      const fmt2 = (n: number) => n.toFixed(2);

      el.innerHTML = `
        <div style="color:${clr};font-weight:700;margin-bottom:5px;font-size:11px;">
          ${fmtDate(row.date, isIntraday(interval))}
        </div>
        <div style="display:grid;grid-template-columns:auto auto;gap:2px 10px;font-size:11px;">
          <span style="color:#94a3b8">Open</span>  <span>${fmt2(row.open)}</span>
          <span style="color:#94a3b8">High</span>  <span style="color:#22c55e">${fmt2(row.high)}</span>
          <span style="color:#94a3b8">Low</span>   <span style="color:#ef4444">${fmt2(row.low)}</span>
          <span style="color:#94a3b8">Close</span> <span style="color:${clr}">${fmt2(row.close)}</span>
        </div>
        <div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.2);font-size:11px;">
          <span style="color:#94a3b8">Volume</span>&nbsp;&nbsp;<span>${fmtVol(row.volume)}</span>
        </div>`;

      el.style.display = 'block';

      // Position: flip to left side when cursor is on the right half
      const TIP_W = el.offsetWidth;
      const TIP_H = el.offsetHeight;
      const MARGIN = 12;
      const x = param.point.x + MARGIN + TIP_W > box.clientWidth
        ? param.point.x - TIP_W - MARGIN
        : param.point.x + MARGIN;
      const y = Math.min(Math.max(param.point.y - TIP_H / 2, 0), box.clientHeight - TIP_H);

      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
    });

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
      volumeRef.current = null;
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    };
  }, [data, chartStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    const fromIdx = getFromIndex(data, timeframe, interval);
    chartRef.current.timeScale().setVisibleLogicalRange({ from: fromIdx, to: data.length - 1 });

    const ch = computeChange(data, fromIdx);
    setChange(ch);

    if (chartStyle === 'line' && seriesRef.current) {
      const isUp = (ch?.abs ?? 0) >= 0;
      const color = isUp ? COLOR_UP : COLOR_DOWN;
      (seriesRef.current as ISeriesApi<'Area'>).applyOptions({
        lineColor: color,
        topColor: isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
        bottomColor: isUp ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.02)',
      });
    }
  }, [timeframe, interval, data.length, chartStyle]);

  useEffect(() => {
    if (!chartRef.current) return;
    const c = CHART_COLORS[theme];
    chartRef.current.applyOptions({
      layout: { background: { color: c.bg }, textColor: c.text },
      grid:   { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      timeScale: { borderColor: c.border },
    });
  }, [theme]);

  const h = HEADER[theme];
  const subtitle = exchangeName ? `${exchangeName}/${ticker}` : ticker;
  const showChange = chartStyle === 'line' && change != null;
  const isUp = (change?.abs ?? 0) >= 0;

  return (
    <div className={`rounded-xl overflow-hidden border ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className={`px-4 py-3 ${h.wrap} flex items-center gap-2`}>
        <span className={`font-semibold text-base ${h.title}`}>{companyName ?? ticker}</span>
        <span className={`text-sm ${h.sub}`}>({subtitle})</span>
        {showChange && (
          <span className={`ml-auto text-sm font-semibold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {formatChange(change!, currency)}
          </span>
        )}
        {!showChange && (
          <span className={`ml-auto text-xs ${h.meta}`}>{interval} candles</span>
        )}
      </div>

      {/* Chart + floating tooltip share the same relative container */}
      <div className="relative">
        <div ref={containerRef} />
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: 10,
            background: 'rgba(15,23,42,0.88)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(51,65,85,0.7)',
            borderRadius: '8px',
            padding: '8px 10px',
            minWidth: '140px',
            lineHeight: '1.6',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
}
