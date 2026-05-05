import { type UTCTimestamp } from 'lightweight-charts';
import { type PriceRow, type Timeframe, type Interval } from '../app/page';

export const MIN_CANDLES = 30;

export const BARS_FOR_WINDOW: Record<Interval, Partial<Record<Timeframe, number>>> = {
  day:   { '1D': 1, '5D': 5, '1M': 22, '3M': 65, '6M': 130, '1Y': 252 },
  hour:  { '1D': 7, '5D': 35, '1M': 143 },
  '30m': { '1D': 13, '5D': 65, '1M': 286 },
  '15m': { '1D': 26, '5D': 130, '1M': 572 },
};

export const isIntraday = (iv: Interval): boolean => iv !== 'day';

export function toTimestamp(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

export function getFromIndex(data: PriceRow[], tf: Timeframe, iv: Interval): number {
  const len = data.length;
  if (len === 0) return 0;

  if (tf === 'ALL') return 0;

  if (tf === 'YTD') {
    const yearStart = new Date().getFullYear().toString();
    for (let i = 0; i < len; i++) {
      if (data[i].date >= yearStart) return i;
    }
    return 0;
  }

  const barCount = BARS_FOR_WINDOW[iv]?.[tf];
  if (barCount != null) {
    const clamped = Math.max(MIN_CANDLES, Math.min(barCount, len));
    return Math.max(0, len - clamped);
  }

  return 0;
}

export function computeChange(
  data: PriceRow[],
  fromIdx: number,
): { abs: number; pct: number } | null {
  if (data.length === 0 || fromIdx >= data.length) return null;
  const startPrice = data[fromIdx].open;
  const endPrice   = data[data.length - 1].close;
  if (startPrice === 0) return null;
  return { abs: endPrice - startPrice, pct: ((endPrice - startPrice) / startPrice) * 100 };
}

export function formatChange(change: { abs: number; pct: number }, currency: string | null): string {
  const sign = change.abs >= 0 ? '+' : '';
  let absStr: string;
  try {
    absStr = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(change.abs));
  } catch {
    absStr = Math.abs(change.abs).toFixed(2);
  }
  return `${sign}${change.abs < 0 ? '-' : ''}${absStr} (${sign}${change.pct.toFixed(2)}%)`;
}
