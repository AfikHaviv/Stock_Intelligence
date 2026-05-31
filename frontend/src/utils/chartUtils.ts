import type { UTCTimestamp } from 'lightweight-charts';
import type { PriceRow, Timeframe, Interval } from '../app/page';

/** Bar counts for setVisibleLogicalRange per interval × timeframe combination. */
export const BARS_FOR_WINDOW: Partial<Record<Interval, Partial<Record<Timeframe, number>>>> = {
  day:  { '1D': 1,  '5D': 5,   '1M': 21,  '3M': 63,  '6M': 126, '1Y': 252 },
  '1h': { '1D': 7,  '5D': 35,  '1M': 168 },
  '30m':{ '1D': 14, '5D': 70,  '1M': 336 },
  '15m':{ '1D': 28, '5D': 140, '1M': 672 },
};

export function isIntraday(iv: Interval): boolean {
  return iv !== 'day';
}

/** ISO datetime string → UTCTimestamp (seconds) for lightweight-charts intraday data. */
export function toTimestamp(isoString: string): UTCTimestamp {
  return Math.floor(new Date(isoString).getTime() / 1000) as UTCTimestamp;
}

/**
 * Returns the data-array index of the first visible bar for the given timeframe.
 * Maps directly to logical range `from` in setVisibleLogicalRange.
 */
export function getFromIndex(data: PriceRow[], tf: Timeframe, iv: Interval): number {
  if (tf === 'ALL') return 0;

  if (tf === 'YTD') {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const idx = data.findIndex((d) => d.date >= yearStart);
    return idx === -1 ? 0 : idx;
  }

  const bars = BARS_FOR_WINDOW[iv]?.[tf];
  if (!bars) return 0;
  return Math.max(0, data.length - bars);
}

/** Absolute and percentage price change from the window-open bar to the latest close. */
export function computeChange(
  data: PriceRow[],
  fromIdx: number
): { abs: number; pct: number } | null {
  if (data.length === 0 || fromIdx >= data.length) return null;
  const open = data[fromIdx].open;
  const last = data[data.length - 1].close;
  const abs = last - open;
  const pct = open === 0 ? 0 : (abs / open) * 100;
  return { abs, pct };
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', ILS: '₪', JPY: '¥', CAD: 'C$', AUD: 'A$',
};

/** Formats as "+$12.34 (+2.50%)" with the correct currency symbol. */
export function formatChange(
  change: { abs: number; pct: number } | null,
  currency = 'USD'
): string {
  if (!change) return '';
  const sign = change.abs >= 0 ? '+' : '';
  const sym = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${sign}${sym}${Math.abs(change.abs).toFixed(2)} (${sign}${change.pct.toFixed(2)}%)`;
}
