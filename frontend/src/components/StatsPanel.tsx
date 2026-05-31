'use client';

import { useMemo } from 'react';
import type { PriceRow, Timeframe, Interval, LiveStats } from '../app/page';
import { getFromIndex } from '../utils/chartUtils';
import { price, compactVol } from '../utils/statsUtils';

interface StatsPanelProps {
  data: PriceRow[];
  stats: LiveStats | null;
  timeframe: Timeframe;
  interval: Interval;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-lg border
                    bg-white border-slate-200 shadow-sm
                    dark:bg-slate-800/60 dark:border-slate-700 dark:shadow-none">
      <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export default function StatsPanel({ data, stats, timeframe, interval }: StatsPanelProps) {
  const currency = stats?.currency ?? 'USD';

  const { open, lastClose, highestClose } = useMemo(() => {
    if (data.length === 0) return { open: null, lastClose: null, highestClose: null };
    const fromIdx = getFromIndex(data, timeframe, interval);
    const window = data.slice(fromIdx);
    return {
      open: data[data.length - 1]?.open ?? null,
      lastClose: data[data.length - 1]?.close ?? null,
      highestClose: window.length > 0 ? Math.max(...window.map((d) => d.close)) : null,
    };
  }, [data, timeframe, interval]);

  const fiftyTwoWkRange =
    stats?.fiftyTwoWeekHigh != null && stats?.fiftyTwoWeekLow != null
      ? `${price(stats.fiftyTwoWeekLow, currency)} – ${price(stats.fiftyTwoWeekHigh, currency)}`
      : '—';

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
      <StatCard label="Last Open" value={price(open, currency)} />
      <StatCard label="Last Close" value={price(lastClose, currency)} />
      <StatCard label="Highest Close" value={price(highestClose, currency)} />
      <StatCard label="52-Week Range" value={fiftyTwoWkRange} />
      <StatCard label="Total Volume" value={compactVol(stats?.volume)} />
    </div>
  );
}
