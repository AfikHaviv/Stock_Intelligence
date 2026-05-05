/**
 * Tests for isTfDisabled — the timeframe button disable logic.
 * Rules:
 *   day   → ALL timeframes enabled
 *   hour  → only 1D, 5D, 1M enabled (3M and beyond disabled)
 *   30m   → only 1D, 5D, 1M enabled
 *   15m   → only 1D, 5D, 1M enabled
 */
import { describe, it, expect } from 'vitest';

// Re-implement the pure logic here (same as page.tsx) to avoid importing
// the React component and Next.js in a Node test environment.
type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
type Interval  = 'day' | 'hour' | '30m' | '15m';

const TIMEFRAME_ORDER: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
const MAX_TIMEFRAME: Record<Interval, Timeframe> = {
  day: 'ALL', hour: '1M', '30m': '1M', '15m': '1M',
};

function isTfDisabled(tf: Timeframe, iv: Interval): boolean {
  return TIMEFRAME_ORDER.indexOf(tf) > TIMEFRAME_ORDER.indexOf(MAX_TIMEFRAME[iv]);
}

describe('isTfDisabled', () => {
  describe('day interval — all timeframes should be enabled', () => {
    const enabled: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
    it.each(enabled)('%s is enabled for day interval', (tf) => {
      expect(isTfDisabled(tf, 'day')).toBe(false);
    });
  });

  describe('hour interval — 1D/5D/1M enabled, 3M and beyond disabled', () => {
    const enabled:  Timeframe[] = ['1D', '5D', '1M'];
    const disabled: Timeframe[] = ['3M', '6M', 'YTD', '1Y', 'ALL'];

    it.each(enabled)('%s is enabled for hour interval', (tf) => {
      expect(isTfDisabled(tf, 'hour')).toBe(false);
    });

    it.each(disabled)('%s is disabled for hour interval', (tf) => {
      expect(isTfDisabled(tf, 'hour')).toBe(true);
    });
  });

  describe('30m interval — same limits as hour', () => {
    const enabled:  Timeframe[] = ['1D', '5D', '1M'];
    const disabled: Timeframe[] = ['3M', '6M', 'YTD', '1Y', 'ALL'];

    it.each(enabled)('%s is enabled for 30m interval', (tf) => {
      expect(isTfDisabled(tf, '30m')).toBe(false);
    });

    it.each(disabled)('%s is disabled for 30m interval', (tf) => {
      expect(isTfDisabled(tf, '30m')).toBe(true);
    });
  });

  describe('15m interval — same limits as hour', () => {
    const enabled:  Timeframe[] = ['1D', '5D', '1M'];
    const disabled: Timeframe[] = ['3M', '6M', 'YTD', '1Y', 'ALL'];

    it.each(enabled)('%s is enabled for 15m interval', (tf) => {
      expect(isTfDisabled(tf, '15m')).toBe(false);
    });

    it.each(disabled)('%s is disabled for 15m interval', (tf) => {
      expect(isTfDisabled(tf, '15m')).toBe(true);
    });
  });
});
