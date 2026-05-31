import { describe, it, expect } from 'vitest';
import { buildFilterTerms, extractSearchQuery, filterRelevantNews } from './newsUtils.js';
import type { NewsArticle } from './newsUtils.js';

describe('buildFilterTerms', () => {
  it('includes the raw ticker', () => {
    expect(buildFilterTerms('AAPL', null)).toContain('AAPL');
  });

  it('strips the exchange suffix from the ticker', () => {
    expect(buildFilterTerms('ESLT.TA', null)[0]).toBe('ESLT');
  });

  it('extracts meaningful words from the company name', () => {
    const terms = buildFilterTerms('AAPL', 'Apple Inc');
    expect(terms).toContain('APPLE');
  });

  it('strips stop words from the company name', () => {
    const terms = buildFilterTerms('AAPL', 'Apple Inc');
    expect(terms).not.toContain('INC');
  });

  it('deduplicates terms', () => {
    const terms = buildFilterTerms('AAPL', 'AAPL Technologies Inc');
    expect(terms.filter((t) => t === 'AAPL')).toHaveLength(1);
  });
});

describe('extractSearchQuery', () => {
  it('returns empty string for null name', () => {
    expect(extractSearchQuery(null)).toBe('');
  });

  it('strips common suffixes', () => {
    const q = extractSearchQuery('Apple Inc');
    expect(q).toBe('Apple');
  });

  it('keeps at most two words', () => {
    const q = extractSearchQuery('International Business Machines Corp');
    expect(q.split(' ').length).toBeLessThanOrEqual(2);
  });
});

describe('filterRelevantNews', () => {
  const articles: NewsArticle[] = [
    { title: 'Apple reports record profits', description: '', url: '', urlToImage: null, source: '', publishedAt: '' },
    { title: 'AAPL stock rises after earnings', description: '', url: '', urlToImage: null, source: '', publishedAt: '' },
    { title: 'Microsoft acquires new company', description: '', url: '', urlToImage: null, source: '', publishedAt: '' },
  ];

  it('falls back to the full list when fewer than minRelevant articles match', () => {
    // Only 2 match AAPL/APPLE, which is < minRelevant=3 → return all 3
    const result = filterRelevantNews(articles, ['AAPL', 'APPLE'], 3);
    expect(result).toHaveLength(3);
  });

  it('returns only matching articles when enough match', () => {
    const bigger: NewsArticle[] = [
      ...articles,
      { title: 'Apple CEO speaks at WWDC', description: '', url: '', urlToImage: null, source: '', publishedAt: '' },
    ];
    // 3 match AAPL/APPLE — meets minRelevant=3
    const result = filterRelevantNews(bigger, ['AAPL', 'APPLE'], 3);
    expect(result).toHaveLength(3);
  });

  it('also matches terms found in the description', () => {
    const withDesc: NewsArticle[] = [
      { title: 'Market update', description: 'AAPL fell 2% in after-hours', url: '', urlToImage: null, source: '', publishedAt: '' },
    ];
    const result = filterRelevantNews(withDesc, ['AAPL'], 1);
    expect(result).toHaveLength(1);
  });
});
