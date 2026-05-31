'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type CandlestickData,
  type AreaData,
  type HistogramData,
  type Time,
} from 'lightweight-charts';
import type { PriceRow, Timeframe, Interval, ChartStyle, ThemeMode } from '../app/page';
import { getFromIndex, isIntraday, toTimestamp } from '../utils/chartUtils';

type MAOverlay = { key: string; color: string; data: { time: string; value: number }[] };

interface StockChartProps {
  data: PriceRow[];
  timeframe: Timeframe;
  interval: Interval;
  chartStyle: ChartStyle;
  theme: ThemeMode;
  maData?: MAOverlay[];
}

function themeColors(isDark: boolean) {
  return {
    bg:     isDark ? '#0f172a' : '#f8fafc',   // slate-900 / slate-50
    text:   isDark ? '#94a3b8' : '#64748b',   // slate-400 / slate-500
    grid:   isDark ? '#1e293b' : '#f1f5f9',   // slate-800 / slate-100
    border: isDark ? '#334155' : '#e2e8f0',   // slate-700 / slate-200
    tooltip: {
      bg:     isDark ? 'rgba(15,23,42,0.88)' : '#ffffff',
      text:   isDark ? '#f1f5f9' : '#0f172a', // slate-100 / slate-900
      border: isDark ? 'rgba(51,65,85,0.7)' : '#e2e8f0',
    },
  };
}

function barTime(date: string, intraday: boolean): Time {
  return intraday ? (toTimestamp(date) as unknown as Time) : (date as Time);
}

export default function StockChart({ data, timeframe, interval, chartStyle, theme, maData = [] }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // ---- Effect 1: Recreate chart when data or chartStyle changes ----
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    chartRef.current?.remove();
    tooltipRef.current?.remove();
    chartRef.current = null;
    tooltipRef.current = null;

    const intraday = isIntraday(interval);
    const c = themeColors(theme === 'dark');

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: intraday, secondsVisible: false },
    });
    chartRef.current = chart;

    // Price series
    let priceSeriesRef: { getData: (t: Time) => CandlestickData | AreaData | undefined } | undefined;

    if (chartStyle === 'candle') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      });
      const cd: CandlestickData[] = data.map((d) => ({
        time: barTime(d.date, intraday),
        open: d.open, high: d.high, low: d.low, close: d.close,
      }));
      s.setData(cd);
      priceSeriesRef = { getData: (t) => cd.find((b) => b.time === t) };
    } else {
      const s = chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59,130,246,0.3)',
        bottomColor: 'rgba(59,130,246,0)',
      });
      const ad: AreaData[] = data.map((d) => ({
        time: barTime(d.date, intraday),
        value: d.close,
      }));
      s.setData(ad);
      priceSeriesRef = { getData: (t) => ad.find((b) => b.time === t) };
    }

    // Volume histogram on a separate scale
    const volSeries = chart.addSeries(HistogramSeries, {
      color: '#6b7280',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const vd: HistogramData[] = data.map((d) => ({
      time: barTime(d.date, intraday),
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
    }));
    volSeries.setData(vd);

    // Moving average overlays
    for (const ma of maData) {
      if (!ma.data.length) continue;
      const maSeries = chart.addSeries(LineSeries, {
        color:            ma.color,
        lineWidth:        2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      maSeries.setData(ma.data.map((d) => ({ time: d.time as Time, value: d.value })));
    }

    // Floating crosshair tooltip
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position:absolute; pointer-events:none; z-index:10;
      font-size:11px; font-family:monospace; line-height:1.6;
      padding:8px 10px; border-radius:6px; display:none;
      background:${c.tooltip.bg}; color:${c.tooltip.text}; border:1px solid ${c.tooltip.border};
    `;
    containerRef.current.style.position = 'relative';
    containerRef.current.appendChild(tooltip);
    tooltipRef.current = tooltip;

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = 'none';
        return;
      }
      const row = data.find((d) => barTime(d.date, intraday) === param.time);
      if (!row) { tooltip.style.display = 'none'; return; }

      tooltip.innerHTML =
        `<div>${row.date}</div>` +
        `<div>O: ${row.open.toFixed(2)}&nbsp;&nbsp;H: ${row.high.toFixed(2)}</div>` +
        `<div>L: ${row.low.toFixed(2)}&nbsp;&nbsp;C: ${row.close.toFixed(2)}</div>` +
        `<div>Vol: ${(row.volume / 1e6).toFixed(2)}M</div>`;
      tooltip.style.display = 'block';

      const cw = containerRef.current?.clientWidth ?? 600;
      const x = param.point.x;
      tooltip.style.left = x > cw / 2 ? `${x - tooltip.offsetWidth - 10}px` : `${x + 10}px`;
      tooltip.style.top = `${Math.max(4, param.point.y - 60)}px`;
    });

    // Responsive resize
    const observer = new ResizeObserver(() => {
      chartRef.current?.applyOptions({ width: containerRef.current?.clientWidth ?? 600 });
    });
    observer.observe(containerRef.current);

    void priceSeriesRef; // suppress unused warning

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      tooltip.remove();
      tooltipRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, chartStyle, maData]);

  // ---- Effect 2: Update visible range without recreating the chart ----
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    const from = getFromIndex(data, timeframe, interval);
    chartRef.current.timeScale().setVisibleLogicalRange({ from, to: data.length - 1 });
  }, [timeframe, interval, data.length, chartStyle, data]);

  // ---- Effect 3: Retheme without recreating the chart ----
  useEffect(() => {
    if (!chartRef.current) return;
    const c = themeColors(theme === 'dark');
    chartRef.current.applyOptions({
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });
    if (tooltipRef.current) {
      tooltipRef.current.style.background = c.tooltip.bg;
      tooltipRef.current.style.color = c.tooltip.text;
      tooltipRef.current.style.borderColor = c.tooltip.border;
    }
  }, [theme]);

  return <div ref={containerRef} className="w-full" />;
}
