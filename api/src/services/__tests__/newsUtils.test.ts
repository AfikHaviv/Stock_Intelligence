import { describe, it, expect } from 'vitest';
import { buildFilterTerms, extractSearchQuery, isTitleRelevant, filterRelevantNews } from '../newsUtils';

// ─── buildFilterTerms ────────────────────────────────────────────────────────

describe('buildFilterTerms', () => {
  it('always includes the ticker uppercased', () => {
    expect(buildFilterTerms('aapl', null)).toContain('AAPL');
  });

  it('strips legal suffixes and keeps the core name', () => {
    const t = buildFilterTerms('AAPL', 'Apple Inc.');
    expect(t).toContain('AAPL');
    expect(t).toContain('APPLE');
    expect(t).not.toContain('INC');
  });

  it('handles "Tesla, Inc." (comma in name)', () => {
    const t = buildFilterTerms('TSLA', 'Tesla, Inc.');
    expect(t).toContain('TSLA');
    expect(t).toContain('TESLA');
  });

  it('handles "NVIDIA Corporation"', () => {
    const t = buildFilterTerms('NVDA', 'NVIDIA Corporation');
    expect(t).toContain('NVDA');
    expect(t).toContain('NVIDIA');
    expect(t).not.toContain('CORPORATION');
  });

  it('splits base ticker for international exchanges (ESLT.TA)', () => {
    const t = buildFilterTerms('ESLT.TA', 'Elbit Systems Ltd.');
    expect(t).toContain('ESLT.TA');
    expect(t).toContain('ESLT');
    expect(t).toContain('ELBIT');
  });

  it('handles "El Al Israel Airlines Ltd." — 2-char tokens EL and AL are included', () => {
    const t = buildFilterTerms('ELAL.TA', 'El Al Israel Airlines Ltd.');
    expect(t).toContain('ELAL.TA');
    expect(t).toContain('ELAL');
    expect(t).toContain('EL');
    expect(t).toContain('AL');
    expect(t).toContain('ISRAEL');
    // legal suffix stripped
    expect(t).not.toContain('AIRLINES');
    expect(t).not.toContain('LTD');
  });

  it('handles AT&T Inc. — ampersand stripped, AT kept (2 chars)', () => {
    const t = buildFilterTerms('T', 'AT&T Inc.');
    expect(t).toContain('T');
    expect(t).toContain('AT');
  });

  it('deduplicates terms', () => {
    const t = buildFilterTerms('NVDA', 'NVDA Holdings');
    expect(t.filter(x => x === 'NVDA').length).toBe(1);
  });

  it('returns only the ticker when companyName is null', () => {
    expect(buildFilterTerms('XYZ', null)).toEqual(['XYZ']);
  });

  it('does not produce empty-string terms', () => {
    const t = buildFilterTerms('AAPL', 'Apple Inc.');
    expect(t.some(x => x === '')).toBe(false);
  });
});

// ─── extractSearchQuery ──────────────────────────────────────────────────────

describe('extractSearchQuery', () => {
  it('returns the brand name for a two-word foreign airline', () => {
    expect(extractSearchQuery('El Al Israel Airlines Ltd.')).toBe('El Al');
  });

  it('returns a single word for simple company names', () => {
    expect(extractSearchQuery('Apple Inc.')).toBe('Apple');
    expect(extractSearchQuery('NVIDIA Corporation')).toBe('NVIDIA');
    expect(extractSearchQuery('Tesla, Inc.')).toBe('Tesla');
  });

  it('returns at most two words', () => {
    const result = extractSearchQuery('Microsoft Corporation');
    expect(result?.split(' ').length).toBeLessThanOrEqual(2);
    expect(result).toBe('Microsoft');
  });

  it('returns two words when both are meaningful', () => {
    // "El Al" needs both words to be distinct from "El Paso", "Al Jazeera", etc.
    expect(extractSearchQuery('El Al Israel Airlines Ltd.')).toBe('El Al');
  });

  it('returns null when no meaningful tokens remain', () => {
    // Pathological: name consists entirely of stripped suffixes
    expect(extractSearchQuery('Inc. Ltd. Corp.')).toBeNull();
  });

  it('handles Samsung Electronics', () => {
    const r = extractSearchQuery('Samsung Electronics Co., Ltd.');
    expect(r).toBe('Samsung Electronics');
  });
});

// ─── isTitleRelevant ─────────────────────────────────────────────────────────

describe('isTitleRelevant', () => {
  it('matches ticker in parentheses', () => {
    expect(isTitleRelevant('Is Apple (AAPL) a Buy?', ['AAPL', 'APPLE'])).toBe(true);
  });

  it('matches company name mid-sentence', () => {
    expect(isTitleRelevant('Apple reports record earnings', ['AAPL', 'APPLE'])).toBe(true);
  });

  it('rejects completely unrelated headline', () => {
    expect(isTitleRelevant('Intel Stock Rises on New Chip Customer', ['AAPL', 'APPLE'])).toBe(false);
  });

  it('rejects ETF article unrelated to ticker', () => {
    expect(isTitleRelevant('Battle of the Broad Market ETFs: VTI vs SCHB', ['TSLA', 'TESLA'])).toBe(false);
  });

  it('does NOT match partial ticker inside a larger word (AAPL ≠ MAPLE)', () => {
    expect(isTitleRelevant('MAPLE Syrup Exports Rise', ['AAPL'])).toBe(false);
  });

  it('does NOT match EL inside INTEL', () => {
    expect(isTitleRelevant('Intel stock rises', ['EL', 'AL', 'ELAL.TA', 'ELAL', 'ISRAEL'])).toBe(false);
  });

  it('does NOT match EL inside POTENTIAL', () => {
    expect(isTitleRelevant('Potential growth ahead', ['EL'])).toBe(false);
  });

  it('matches EL at the start of a headline (El Al news)', () => {
    expect(isTitleRelevant('El Al Israel Airlines Reports Q2 Results', ['EL', 'AL', 'ISRAEL'])).toBe(true);
  });

  it('matches "El Al" as a phrase via the EL term', () => {
    expect(isTitleRelevant('El Al to expand routes to New York', ['EL', 'AL', 'ELAL'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isTitleRelevant('tesla robotaxi expansion', ['TSLA', 'TESLA'])).toBe(true);
  });

  it('returns false for empty terms list', () => {
    expect(isTitleRelevant('Apple reports earnings', [])).toBe(false);
  });

  it('matches ticker at the end of a headline', () => {
    expect(isTitleRelevant('Analysts raise target for TSLA', ['TSLA', 'TESLA'])).toBe(true);
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
  const noiseArticles = [
    { title: 'Intel stock rises on new chip deal' },
    { title: 'Battle of the Broad Market ETFs: VTI vs SCHB' },
    { title: 'Fed signals rate cut in December' },
    { title: 'Oil prices surge on OPEC decision' },
    { title: 'Bitcoin hits new all-time high' },
  ];

  it('returns only relevant articles when enough pass', () => {
    const filtered = filterRelevantNews([...appleArticles, ...noiseArticles], terms);
    expect(filtered.length).toBe(appleArticles.length);
    filtered.forEach(a => expect(isTitleRelevant(a.title, terms)).toBe(true));
  });

  it('falls back to full list when fewer than minRelevant pass', () => {
    const sparse = [appleArticles[0], appleArticles[1], ...noiseArticles];
    expect(filterRelevantNews(sparse, terms)).toEqual(sparse);
  });

  it('respects a custom minRelevant threshold', () => {
    const sparse = [appleArticles[0], appleArticles[1], ...noiseArticles];
    expect(filterRelevantNews(sparse, terms, 2).length).toBe(2);
  });

  it('preserves article order', () => {
    const filtered = filterRelevantNews(appleArticles, terms);
    expect(filtered[0].title).toBe(appleArticles[0].title);
  });

  // El Al scenario: primary ticker search returns noise, secondary name search
  // adds real El Al articles → filter should now keep them
  it('correctly filters El Al articles after company-name search is merged', () => {
    const elAlTerms = ['ELAL.TA', 'ELAL', 'EL', 'AL', 'ISRAEL'];
    const elAlArticles = [
      { title: 'El Al Israel Airlines Reports Q2 Profit' },
      { title: 'El Al to launch new routes to New York' },
      { title: 'El Al fleet expansion underway' },
      { title: 'Israel aviation sector faces headwinds' },
    ];
    const junkFromTickerSearch = [
      { title: 'Intel stock rises on new chip deal' },
      { title: 'Fnac Darty: Notice to convertible bond holders' },
      { title: 'Liberty Tire Recycling 2025 Sustainability Report' },
    ];
    const merged = [...junkFromTickerSearch, ...elAlArticles];
    const filtered = filterRelevantNews(merged, elAlTerms);
    // All returned articles should be El Al / Israel related
    filtered.forEach(a => expect(isTitleRelevant(a.title, elAlTerms)).toBe(true));
    expect(filtered.length).toBe(elAlArticles.length);
  });
});
