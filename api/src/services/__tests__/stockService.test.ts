import { describe, it, expect } from 'vitest';
import { dbRowToPriceRow, normalizeExchange } from '../stockService';

// ── dbRowToPriceRow ──────────────────────────────────────────────────────────

describe('dbRowToPriceRow', () => {
  it('converts a standard DB row to a PriceRow', () => {
    const row = {
      date:   new Date('2024-06-15T00:00:00.000Z'),
      open:   '150.50',
      high:   '155.00',
      low:    '149.00',
      close:  '152.75',
      volume: '1000000',
    };
    expect(dbRowToPriceRow(row)).toEqual({
      date:   '2024-06-15',
      open:   150.50,
      high:   155.00,
      low:    149.00,
      close:  152.75,
      volume: 1000000,
    });
  });

  it('strips the time component from the date', () => {
    const row = {
      date:   new Date('2024-01-01T12:30:00.000Z'),
      open:   '100',
      high:   '110',
      low:    '90',
      close:  '105',
      volume: '500',
    };
    expect(dbRowToPriceRow(row).date).toBe('2024-01-01');
  });

  it('parses numeric strings with decimal precision', () => {
    const row = {
      date:   new Date('2024-03-10'),
      open:   '1234.5678',
      high:   '1300.0001',
      low:    '1200.9999',
      close:  '1250.1234',
      volume: '9876543',
    };
    const result = dbRowToPriceRow(row);
    expect(result.open).toBeCloseTo(1234.5678);
    expect(result.volume).toBe(9876543);
  });

  it('handles zero values correctly', () => {
    const row = {
      date:   new Date('2024-01-01'),
      open:   '0',
      high:   '0',
      low:    '0',
      close:  '0',
      volume: '0',
    };
    const result = dbRowToPriceRow(row);
    expect(result.open).toBe(0);
    expect(result.volume).toBe(0);
  });
});

// ── normalizeExchange ────────────────────────────────────────────────────────
// Twelve Data returns clean exchange names (e.g. "NASDAQ", "NYSE", "TASE"),
// so normalizeExchange now takes a single string and maps known variants.

describe('normalizeExchange', () => {
  it('returns "Nasdaq" for strings containing "nasdaq" (case-insensitive)', () => {
    expect(normalizeExchange('NASDAQ')).toBe('Nasdaq');
    expect(normalizeExchange('NasdaqGS')).toBe('Nasdaq');
    expect(normalizeExchange('nasdaq')).toBe('Nasdaq');
  });

  it('returns "NYSE" for strings containing "nyse" (case-insensitive)', () => {
    expect(normalizeExchange('NYSE')).toBe('NYSE');
    expect(normalizeExchange('NYSE Arca')).toBe('NYSE');
    expect(normalizeExchange('nyse')).toBe('NYSE');
  });

  it('returns the exchange string as-is for other exchanges', () => {
    expect(normalizeExchange('TASE')).toBe('TASE');
    expect(normalizeExchange('LSE')).toBe('LSE');
    expect(normalizeExchange('XETRA')).toBe('XETRA');
  });

  it('returns null for null, undefined, or empty string', () => {
    expect(normalizeExchange(null)).toBeNull();
    expect(normalizeExchange(undefined)).toBeNull();
    expect(normalizeExchange('')).toBeNull();
  });
});
