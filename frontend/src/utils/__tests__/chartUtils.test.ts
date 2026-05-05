import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toTimestamp,
  isIntraday,
  getFromIndex,
  computeChange,
  formatChange,
  MIN_CANDLES,
} from '../chartUtils';
import type { PriceRow } from '../../app/page';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRow(date: string, open = 100, close = 100): PriceRow {
  return { date, open, high: close, low: open, close, volume: 1000 };
}

function makeRows(dates: string[]): PriceRow[] {
  return dates.map((d) => makeRow(d));
}

// ── toTimestamp ──────────────────────────────────────────────────────────────

describe('toTimestamp', () => {
  it('converts an ISO date string to a Unix timestamp in seconds', () => {
    expect(toTimestamp('2024-01-01T00:00:00.000Z')).toBe(1704067200);
  });

  it('returns an integer (floors milliseconds)', () => {
    const ts = toTimestamp('2024-06-15T12:30:45.999Z');
    expect(Number.isInteger(ts)).toBe(true);
  });
});

// ── isIntraday ───────────────────────────────────────────────────────────────

describe('isIntraday', () => {
  it('returns false for "day" interval', () => {
    expect(isIntraday('day')).toBe(false);
  });

  it('returns true for all intraday intervals', () => {
    expect(isIntraday('hour')).toBe(true);
    expect(isIntraday('30m')).toBe(true);
    expect(isIntraday('15m')).toBe(true);
  });
});

// ── getFromIndex ─────────────────────────────────────────────────────────────

describe('getFromIndex', () => {
  it('returns 0 for empty data', () => {
    expect(getFromIndex([], 'ALL', 'day')).toBe(0);
    expect(getFromIndex([], '6M', 'day')).toBe(0);
  });

  it('returns 0 for ALL timeframe regardless of data length', () => {
    const data = makeRows(['2020-01-01', '2021-01-01', '2024-01-01']);
    expect(getFromIndex(data, 'ALL', 'day')).toBe(0);
  });

  it('finds the first row in the current year for YTD', () => {
    const currentYear = new Date().getFullYear();
    const data = makeRows([
      `${currentYear - 1}-12-30`,
      `${currentYear - 1}-12-31`,
      `${currentYear}-01-02`,
      `${currentYear}-06-15`,
    ]);
    expect(getFromIndex(data, 'YTD', 'day')).toBe(2);
  });

  it('returns 0 for YTD when all data is in the current year', () => {
    const year = new Date().getFullYear();
    const data = makeRows([`${year}-01-01`, `${year}-06-01`]);
    expect(getFromIndex(data, 'YTD', 'day')).toBe(0);
  });

  it('returns 0 for YTD when all data is from previous years', () => {
    const data = makeRows(['2020-01-01', '2021-06-01']);
    expect(getFromIndex(data, 'YTD', 'day')).toBe(0);
  });

  it('calculates correct bar-count window for 6M/day (130 bars)', () => {
    // 200 rows of daily data → last 130 should be shown (from index 70)
    const dates = Array.from({ length: 200 }, (_, i) => `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`);
    const data = makeRows(dates);
    expect(getFromIndex(data, '6M', 'day')).toBe(200 - 130);
  });

  it('clamps to MIN_CANDLES when bar count is below minimum', () => {
    // '1D' for day = 1 bar, but MIN_CANDLES = 30, so result should clamp
    const data = makeRows(Array.from({ length: 100 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`));
    const idx = getFromIndex(data, '1D', 'day');
    expect(data.length - idx).toBeGreaterThanOrEqual(MIN_CANDLES);
  });

  it('clamps from index to 0 when data is shorter than bar count', () => {
    // 1M/day = 22 bars, but only 10 rows → from 0
    const data = makeRows(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(getFromIndex(data, '1M', 'day')).toBe(0);
  });
});

// ── computeChange ────────────────────────────────────────────────────────────

describe('computeChange', () => {
  it('returns null for empty data', () => {
    expect(computeChange([], 0)).toBeNull();
  });

  it('returns null when fromIdx >= data.length', () => {
    const data = [makeRow('2024-01-01', 100, 110)];
    expect(computeChange(data, 1)).toBeNull();
    expect(computeChange(data, 99)).toBeNull();
  });

  it('returns null when startPrice is 0 (avoid division by zero)', () => {
    const data = [makeRow('2024-01-01', 0, 110)];
    expect(computeChange(data, 0)).toBeNull();
  });

  it('computes a positive change correctly', () => {
    const data = [
      makeRow('2024-01-01', 100, 110), // open 100
      makeRow('2024-01-02', 110, 120), // close 120
    ];
    const result = computeChange(data, 0);
    expect(result).not.toBeNull();
    expect(result!.abs).toBeCloseTo(20);    // 120 - 100
    expect(result!.pct).toBeCloseTo(20);    // 20 / 100 * 100
  });

  it('computes a negative change correctly', () => {
    const data = [
      makeRow('2024-01-01', 200, 180),
      makeRow('2024-01-02', 180, 160),
    ];
    const result = computeChange(data, 0);
    expect(result!.abs).toBeCloseTo(-40);
    expect(result!.pct).toBeCloseTo(-20);
  });

  it('uses the open price of fromIdx row (not the first row)', () => {
    const data = [
      makeRow('2024-01-01', 50,  50),   // row 0 — not used
      makeRow('2024-01-02', 100, 100),  // row 1 — fromIdx, open = 100
      makeRow('2024-01-03', 100, 150),  // last row, close = 150
    ];
    const result = computeChange(data, 1);
    expect(result!.abs).toBeCloseTo(50);  // 150 - 100
    expect(result!.pct).toBeCloseTo(50);  // 50 / 100 * 100
  });
});

// ── formatChange ─────────────────────────────────────────────────────────────

describe('formatChange', () => {
  it('formats a positive USD change with + prefix', () => {
    const result = formatChange({ abs: 12.34, pct: 5.67 }, 'USD');
    expect(result).toContain('+');
    expect(result).toContain('5.67%');
    expect(result).toContain('12.34');
  });

  it('formats a negative USD change with - sign', () => {
    const result = formatChange({ abs: -8.5, pct: -4.25 }, 'USD');
    expect(result).toContain('-');
    expect(result).toContain('4.25%');
  });

  it('formats with ILS currency symbol', () => {
    const result = formatChange({ abs: 100, pct: 2.5 }, 'ILS');
    // ILS uses ₪ symbol
    expect(result).toContain('₪');
    expect(result).toContain('+');
  });

  it('falls back gracefully for an invalid currency code', () => {
    const result = formatChange({ abs: 50, pct: 10 }, 'INVALID_CURRENCY');
    // Should not throw; should still show the percentage
    expect(result).toContain('10.00%');
    expect(result).toContain('+');
  });

  it('handles zero change', () => {
    const result = formatChange({ abs: 0, pct: 0 }, 'USD');
    expect(result).toContain('+');
    expect(result).toContain('0.00%');
  });
});
