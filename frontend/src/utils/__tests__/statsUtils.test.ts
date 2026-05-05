import { describe, it, expect } from 'vitest';
import { price, compactCap, compactVol, currencySymbol } from '../statsUtils';

// ── currencySymbol ────────────────────────────────────────────────────────────

describe('currencySymbol', () => {
  it('returns "$" for USD', () => {
    expect(currencySymbol('USD')).toBe('$');
  });

  it('returns "€" for EUR', () => {
    expect(currencySymbol('EUR')).toBe('€');
  });

  it('returns "£" for GBP', () => {
    expect(currencySymbol('GBP')).toBe('£');
  });

  it('returns "₪" for ILS (Israeli Shekel)', () => {
    expect(currencySymbol('ILS')).toBe('₪');
  });

  it('returns "$" when currency is null (defaults to USD)', () => {
    expect(currencySymbol(null)).toBe('$');
  });

  it('returns "$" for an invalid currency code', () => {
    expect(currencySymbol('INVALID')).toBe('$');
  });
});

// ── price ─────────────────────────────────────────────────────────────────────

describe('price', () => {
  it('returns "—" for null', () => {
    expect(price(null, 'USD')).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(price(undefined, 'USD')).toBe('—');
  });

  it('formats a USD price correctly', () => {
    expect(price(152.75, 'USD')).toBe('$152.75');
  });

  it('formats an ILS price with the correct symbol', () => {
    const result = price(500, 'ILS');
    expect(result).toContain('₪');
    expect(result).toContain('500');
  });

  it('always shows 2 decimal places', () => {
    expect(price(100, 'USD')).toBe('$100.00');
    expect(price(99.9, 'USD')).toBe('$99.90');
  });

  it('falls back to toFixed(2) for invalid currency', () => {
    const result = price(123.4, 'INVALID');
    expect(result).toBe('123.40');
  });

  it('formats zero correctly', () => {
    expect(price(0, 'USD')).toBe('$0.00');
  });
});

// ── compactCap ────────────────────────────────────────────────────────────────

describe('compactCap', () => {
  it('returns "—" for null', () => {
    expect(compactCap(null, 'USD')).toBe('—');
  });

  it('formats trillions with T suffix', () => {
    expect(compactCap(3e12, 'USD')).toBe('$3.00T');
    expect(compactCap(2.5e12, 'USD')).toBe('$2.50T');
  });

  it('formats billions with B suffix', () => {
    expect(compactCap(1.5e9, 'USD')).toBe('$1.50B');
  });

  it('formats millions with M suffix', () => {
    expect(compactCap(750e6, 'USD')).toBe('$750.00M');
  });

  it('formats small values with locale number formatting', () => {
    const result = compactCap(500000, 'USD');
    expect(result).toContain('500');
    expect(result).toContain('$');
  });

  it('uses ILS symbol for Israeli stocks', () => {
    const result = compactCap(5e9, 'ILS');
    expect(result).toContain('₪');
    expect(result).toContain('B');
  });
});

// ── compactVol ────────────────────────────────────────────────────────────────

describe('compactVol', () => {
  it('returns "—" for null', () => {
    expect(compactVol(null)).toBe('—');
  });

  it('formats billions with B suffix', () => {
    expect(compactVol(1.5e9)).toBe('1.50B');
  });

  it('formats millions with M suffix', () => {
    expect(compactVol(50e6)).toBe('50.00M');
  });

  it('formats thousands with K suffix (1 decimal place)', () => {
    expect(compactVol(12500)).toBe('12.5K');
    expect(compactVol(1000)).toBe('1.0K');
  });

  it('formats values below 1000 as plain numbers', () => {
    expect(compactVol(500)).toBe('500');
    expect(compactVol(0)).toBe('0');
  });

  it('formats exactly 1B as 1.00B', () => {
    expect(compactVol(1e9)).toBe('1.00B');
  });

  it('formats exactly 1M as 1.00M', () => {
    expect(compactVol(1e6)).toBe('1.00M');
  });
});
