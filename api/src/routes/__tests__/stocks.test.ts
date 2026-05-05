import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// Mock the entire service module before importing the routes
vi.mock('../../services/stockService', () => ({
  getOrFetchStock: vi.fn(),
  getHourlyData:   vi.fn(),
  get30MinData:    vi.fn(),
  get15MinData:    vi.fn(),
  getStockStats:   vi.fn(),
}));

import { stockRoutes } from '../stocks';
import * as svc from '../../services/stockService';

const mockGetOrFetchStock = vi.mocked(svc.getOrFetchStock);
const mockGetHourlyData   = vi.mocked(svc.getHourlyData);
const mockGetStockStats   = vi.mocked(svc.getStockStats);

const FAKE_PRICES = [
  { date: '2024-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

async function buildApp() {
  const app = Fastify();
  await app.register(stockRoutes);
  return app;
}

describe('GET /api/stocks/:ticker', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => { await app.close(); vi.clearAllMocks(); });

  it('returns 400 for a ticker containing special characters', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stocks/BAD@TICKER' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid ticker' });
  });

  it('returns 400 for a ticker longer than 10 characters', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stocks/TOOLONGTICKER' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid ticker' });
  });

  it('returns 400 for an empty ticker segment', async () => {
    // Fastify matches /api/stocks/ with an empty param; the regex rejects it → 400
    const res = await app.inject({ method: 'GET', url: '/api/stocks/' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid ticker' });
  });

  it('returns 200 with price data for a valid ticker', async () => {
    mockGetOrFetchStock.mockResolvedValue(FAKE_PRICES);
    const res = await app.inject({ method: 'GET', url: '/api/stocks/AAPL' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(FAKE_PRICES);
    expect(mockGetOrFetchStock).toHaveBeenCalledWith('AAPL');
  });

  it('accepts tickers with dot suffix (e.g. ESLT.TA)', async () => {
    mockGetOrFetchStock.mockResolvedValue(FAKE_PRICES);
    const res = await app.inject({ method: 'GET', url: '/api/stocks/ESLT.TA' });
    expect(res.statusCode).toBe(200);
    expect(mockGetOrFetchStock).toHaveBeenCalledWith('ESLT.TA');
  });

  it('returns 500 with a generic error message when the service throws', async () => {
    mockGetOrFetchStock.mockRejectedValue(new Error('DB connection failed'));
    const res = await app.inject({ method: 'GET', url: '/api/stocks/AAPL' });
    expect(res.statusCode).toBe(500);
    // Must NOT leak the raw internal error message
    expect(res.json().error).toBe('Internal server error');
    expect(res.json().error).not.toContain('DB connection');
  });
});

describe('GET /api/stocks/:ticker/hourly', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => { await app.close(); vi.clearAllMocks(); });

  it('returns 400 for an invalid ticker', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stocks/BAD!TKR/hourly' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with intraday data for a valid ticker', async () => {
    mockGetHourlyData.mockResolvedValue(FAKE_PRICES);
    const res = await app.inject({ method: 'GET', url: '/api/stocks/TSLA/hourly' });
    expect(res.statusCode).toBe(200);
    expect(mockGetHourlyData).toHaveBeenCalledWith('TSLA');
  });
});

describe('GET /api/stocks/:ticker/stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => { await app.close(); vi.clearAllMocks(); });

  it('returns stats for a valid ticker', async () => {
    const fakeStats = {
      name: 'Apple Inc.', exchangeName: 'Nasdaq', currency: 'USD',
      marketCap: 3e12, fiftyTwoWeekHigh: 200, fiftyTwoWeekLow: 140, volume: 50_000_000,
    };
    mockGetStockStats.mockResolvedValue(fakeStats);
    const res = await app.inject({ method: 'GET', url: '/api/stocks/AAPL/stats' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(fakeStats);
  });

  it('returns 500 when the stats service throws', async () => {
    mockGetStockStats.mockRejectedValue(new Error('Yahoo Finance timeout'));
    const res = await app.inject({ method: 'GET', url: '/api/stocks/AAPL/stats' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('Internal server error');
  });
});
