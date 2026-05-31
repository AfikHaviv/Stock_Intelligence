'use client';

import { useState } from 'react';

type Props = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: string;
};

type Segment = { label: string; count: number; pct: number; color: string };

// Tailwind can't interpolate dynamic colors, so hex values are used in the gradient string
const SEGMENT_HEX = ['#047857', '#34d399', '#fb923c', '#f87171', '#b91c1c'];

function getConsensus(strongBuy: number, buy: number, hold: number, sell: number, strongSell: number): string | null {
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return null;
  const totalBuy  = strongBuy + buy;
  const totalSell = sell + strongSell;
  if (totalBuy >= totalSell && totalBuy >= hold) return strongBuy > buy ? 'Strong Buy' : 'Buy';
  if (totalSell >= totalBuy && totalSell >= hold) return strongSell > sell ? 'Strong Sell' : 'Sell';
  return 'Hold';
}

const LABEL_COLOR: Record<string, string> = {
  'Strong Buy':  'text-emerald-400',
  'Buy':         'text-emerald-500',
  'Hold':        'text-orange-400',
  'Sell':        'text-red-500',
  'Strong Sell': 'text-red-400',
};

export default function AnalystBar({ strongBuy, buy, hold, sell, strongSell, period }: Props) {
  const [tooltip, setTooltip]   = useState<Segment | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return null;

  const consensus = getConsensus(strongBuy, buy, hold, sell, strongSell);
  if (!consensus) return null;

  const segments: Segment[] = [
    { label: 'Strong Buy',  count: strongBuy,  pct: (strongBuy  / total) * 100, color: 'text-emerald-400' },
    { label: 'Buy',         count: buy,         pct: (buy        / total) * 100, color: 'text-emerald-500' },
    { label: 'Hold',        count: hold,        pct: (hold       / total) * 100, color: 'text-orange-400'  },
    { label: 'Sell',        count: sell,        pct: (sell       / total) * 100, color: 'text-red-500'     },
    { label: 'Strong Sell', count: strongSell,  pct: (strongSell / total) * 100, color: 'text-red-400'     },
  ];

  // Each color stays solid for most of its segment; blends only within ±FADE pp of each boundary
  const FADE = 4;
  const boundaries: number[] = [];
  let cum = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    cum += segments[i].pct;
    boundaries.push(cum);
  }

  const stops: string[] = [`${SEGMENT_HEX[0]} 0%`];
  boundaries.forEach((b, i) => {
    stops.push(`${SEGMENT_HEX[i]}     ${Math.max(0,   b - FADE).toFixed(1)}%`);
    stops.push(`${SEGMENT_HEX[i + 1]} ${Math.min(100, b + FADE).toFixed(1)}%`);
  });
  stops.push(`${SEGMENT_HEX[SEGMENT_HEX.length - 1]} 100%`);

  const gradient = `linear-gradient(to bottom, ${stops.join(', ')})`;

  // Determine which segment the cursor is over based on Y position
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    // Position the fixed tooltip to the right of the bar's viewport edge
    setTooltipPos({ x: rect.right + 8, y: e.clientY });
    let cumulative = 0;
    for (const seg of segments) {
      cumulative += seg.pct;
      if (yPct <= cumulative) { setTooltip(seg); return; }
    }
    setTooltip(segments[segments.length - 1]);
  };

  const periodLabel = period
    ? new Date(period + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="relative flex flex-col gap-3 py-4 px-3 w-28 shrink-0 border-l border-slate-200 dark:border-slate-700">

      {/* Title + consensus */}
      <div className="flex flex-col gap-1">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Analyst review:
        </p>
        <span className={`text-sm font-bold leading-tight ${LABEL_COLOR[consensus]}`}>
          {consensus}
        </span>
      </div>

      {/* Gradient bar — single div, colors fade into each other */}
      <div
        className="w-5 flex-1 rounded-full min-h-0 cursor-default"
        style={{ background: gradient }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />

      {periodLabel && (
        <p className="text-[9px] text-slate-400 dark:text-slate-600">{periodLabel}</p>
      )}

      {/* Tooltip — position:fixed escapes overflow-hidden on all ancestor containers */}
      {tooltip && (
        <div
          style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y, transform: 'translateY(-50%)' }}
          className="z-50 bg-slate-900 dark:bg-slate-800 text-slate-100
                     text-[11px] rounded-md px-2.5 py-1.5 shadow-xl
                     whitespace-nowrap pointer-events-none
                     border border-slate-700 dark:border-slate-600"
        >
          <p className={`font-semibold mb-0.5 ${tooltip.color}`}>{tooltip.label}</p>
          <p className="text-slate-300 dark:text-slate-400 tabular-nums">
            {tooltip.count} analyst{tooltip.count !== 1 ? 's' : ''} &middot; {tooltip.pct.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}
