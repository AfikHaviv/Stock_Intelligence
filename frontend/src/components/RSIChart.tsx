'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import type { PriceRow, Timeframe, Interval, ThemeMode } from '../app/page';
import { getFromIndex } from '../utils/chartUtils';

type RSIPoint = { time: string; value: number };

interface Props {
  data:      RSIPoint[];
  priceData: PriceRow[];
  timeframe: Timeframe;
  interval:  Interval;
  theme:     ThemeMode;
}

function themeColors(isDark: boolean) {
  return {
    bg:     isDark ? '#0f172a' : '#f8fafc',
    text:   isDark ? '#94a3b8' : '#64748b',
    grid:   isDark ? '#1e293b' : '#f1f5f9',
    border: isDark ? '#334155' : '#e2e8f0',
  };
}

export default function RSIChart({ data, priceData, timeframe, interval, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  // Effect 1: create chart when data arrives
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    chartRef.current?.remove();
    chartRef.current = null;

    const c = themeColors(theme === 'dark');
    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 110,
      layout: { background: { color: c.bg }, textColor: c.text },
      grid:   { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: c.border, visible: false },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale:  false,
    });
    chartRef.current = chart;

    const rsiSeries = chart.addSeries(LineSeries, {
      color:             '#fb923c',
      lineWidth:         2,
      priceLineVisible:  false,
      lastValueVisible:  false,
    });
    rsiSeries.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));

    rsiSeries.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.45)',   lineWidth: 1, lineStyle: 2, title: '70' });
    rsiSeries.createPriceLine({ price: 50, color: 'rgba(148,163,184,0.25)', lineWidth: 1, lineStyle: 2, title: ''   });
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(34,197,94,0.45)',   lineWidth: 1, lineStyle: 2, title: '30' });

    const observer = new ResizeObserver(() => {
      chartRef.current?.applyOptions({ width: containerRef.current?.clientWidth ?? 600 });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Effect 2: sync visible range with main chart
  useEffect(() => {
    if (!chartRef.current || data.length === 0 || priceData.length === 0) return;
    const fromPriceIdx = getFromIndex(priceData, timeframe, interval);
    const targetDate   = priceData[fromPriceIdx]?.date;
    const from = targetDate ? Math.max(0, data.findIndex((d) => d.time >= targetDate)) : 0;
    chartRef.current.timeScale().setVisibleLogicalRange({ from, to: data.length - 1 });
  }, [timeframe, interval, data, priceData]);

  // Effect 3: retheme
  useEffect(() => {
    if (!chartRef.current) return;
    const c = themeColors(theme === 'dark');
    chartRef.current.applyOptions({
      layout:          { background: { color: c.bg }, textColor: c.text },
      grid:            { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale:       { borderColor: c.border },
    });
  }, [theme]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">RSI (14)</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">30 oversold · 70 overbought</span>
      </div>
      <div className="p-2">
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
}
