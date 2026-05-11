import { describe, it, expect } from 'vitest';
import { buildFilterTerms, isTitleRelevant, filterRelevantNews } from '../newsUtils';

// ─── buildFilterTerms ────────────────────────────────────────────────────────

describe('buildFilterTerms', () => {
  it('always includes the ticker uppercased', () => {
    const terms = buildFilterTerms('aapl', null);
    expect(terms).toContain('AAPL');
  });

  it('strips legal suffixes and keeps the core name', () => {
    const terms = buildFilterTerms('AAPL', 'Apple Inc.');
    expect(terms).toContain('AAPL');
    expect(terms).toContain('APPLE');
    expect(terms).not.toContain('INC');
    expect(terms).not.toContain('INC.');
  });

  it('handles "Tesla, Inc." (comma in name)', () => {
    const terms = buildFilterTerms('TSLA', 'Tesla, Inc.');
    expect(terms).toContain('TSLA');
    expect(terms).toContain('TESLA');
  });

  it('handles "NVIDIA Corporation"', () => {
    const terms = buildFilterTerms('NVDA', 'NVIDIA Corporation');
    expect(terms).toContain('NVDA');
    expect(terms).toContain('NVIDIA');
    expect(terms).not.toContain('CORPORATION');
  });

  it('handles "Microsoft Corporation"', () => {
    const terms = buildFilterTerms('MSFT', 'Microsoft Corporation');
    expect(terms).toContain('MSFT');
    expect(terms).toContain('MICROSOFT');
  });

  it('splits base ticker for international exchanges (ESLT.TA)', () => {
    const terms = buildFilterTerms('ESLT.TA', 'Elbit Systems Ltd.');
    expect(terms).toContain('ESLT.TA');
    expect(terms).toContain('ESLT');
    expect(terms).toContain('ELBIT');
  });

  it('does not split for non-dotted tickers', () => {
    const terms = buildFilterTerms('AAPL', 'Apple Inc.');
    // Should NOT contain a spurious split artefact
    expect(terms.some(t => t === '')).toBe(false);
  });

  it('drops tokens shorter than 3 characters', () => {
    // "AT&T Inc." → "AT" (length 2 after strip) should be dropped
    const terms = buildFilterTerms('T', 'AT&T Inc.');
    // "AT" is 2 chars; "AT&T" after punct strip becomes "AT T" → both < 3 → dropped
    // But the ticker "T" itself should remain
    expect(terms).toContain('T');
    expect(terms.filter(t => t === 'AT')).toHaveLength(0);
  });

  it('deduplicates terms', () => {
    // Company name same as ticker shouldn't produce duplicate
    const terms = buildFilterTerms('NVDA', 'NVDA Holdings');
    const count = terms.filter(t => t === 'NVDA').length;
    expect(count).toBe(1);
  });

  it('returns just the ticker when companyName is null', () => {
    const terms = buildFilterTerms('XYZ', null);
    expect(terms).toEqual(['XYZ']);
  });
});

// ─── isTitleRelevant ─────────────────────────────────────────────────────────

describe('isTitleRelevant', () => {
  it('matches ticker in parentheses', () => {
    expect(isTitleRelevant('Is Apple (AAPL) a Buy?', ['AAPL', 'APPLE'])).toBe(true);
  });

  it('matches company name', () => {
    expect(isTitleRelevant('Apple reports record earnings', ['AAPL', 'APPLE'])).toBe(true);
  });

  it('rejects completely unrelated headline', () => {
    expect(isTitleRelevant('Intel Stock Rises on New Chip Customer', ['AAPL', 'APPLE'])).toBe(false);
  });

  it('rejects ETF article unrelated to ticker', () => {
    expect(isTitleRelevant('Battle of the Broad Market ETFs: VTI vs SCHB', ['TSLA', 'TESLA'])).toBe(false);
  });

  it('matches when ticker appears without spaces (e.g. at end of headline)', () => {
    expect(isTitleRelevant('Analysts upgrade TSLA', ['TSLA', 'TESLA'])).toBe(true);
  });

  it('does NOT match partial ticker inside a larger word', () => {
    // "AAPL" should not match "MAPLE" — word-boundary check
    expect(isTitleRelevant('MAPLE Syrup Exports Rise', ['AAPL'])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isTitleRelevant('tesla robotaxi expansion', ['TSLA', 'TESLA'])).toBe(true);
  });

  it('matches when company name is mid-sentence', () => {
    expect(isTitleRelevant('CEO of Nvidia talks AI strategy', ['NVDA', 'NVIDIA'])).toBe(true);
  });

  it('returns false for empty terms list', () => {
    expect(isTitleRelevant('Apple reports earnings', [])).toBe(false);
  });
});

// ─── filterRelevantNews ──────────────────────────────────────────────────────

describe('filterRelevantNews', () => {
  const terms = ['AAPL', 'APPLE'];

  const appleArticles = [
    { title: 'Apple reports record iPhone sales' },
    { title: 'Is Apple (AAPL) a Buy? Analysts weigh in' },
    { title: 'Apple event preview: What to expect' },
    { title: 'Apple vs Microsoft: Who wins the AI race?' },
    { title: 'Apple faces EU antitrust scrutiny' },
  ];

  const noisyArticles = [
    { title: 'Intel stock rises on new chip deal' },
    { title: 'Battle of the Broad Market ETFs: VTI vs SCHB' },
    { title: 'Fed signals rate cut in December' },
    { title: 'Oil prices surge on OPEC decision' },
    { title: 'Bitcoin hits new all-time high' },
  ];

  it('returns only relevant articles when enough pass the filter', () => {
    const mixed = [...appleArticles, ...noisyArticles];
    const filtered = filterRelevantNews(mixed, terms);
    expect(filtered.length).toBe(appleArticles.length);
    filtered.forEach(a => expect(isTitleRelevant(a.title, terms)).toBe(true));
  });

  it('falls back to full list when fewer than minRelevant pass', () => {
    // Only 2 apple articles mixed with 8 noise → below default minRelevant (4)
    const sparse = [appleArticles[0], appleArticles[1], ...noisyArticles];
    const result = filterRelevantNews(sparse, terms);
    expect(result).toEqual(sparse);   // full fallback
  });

  it('respects a custom minRelevant threshold', () => {
    // 2 relevant articles, minRelevant = 2 → should NOT fall back
    const sparse = [appleArticles[0], appleArticles[1], ...noisyArticles];
    const result = filterRelevantNews(sparse, terms, 2);
    expect(result.length).toBe(2);
  });

  it('preserves article order', () => {
    const filtered = filterRelevantNews(appleArticles, terms);
    expect(filtered[0].title).toBe(appleArticles[0].title);
  });

  it('returns full list unchanged when all articles are relevant', () => {
    const result = filterRelevantNews(appleArticles, terms);
    expect(result).toHaveLength(appleArticles.length);
  });
});
