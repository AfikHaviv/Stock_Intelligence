const STOP_WORDS = new Set([
  'INC', 'CORP', 'CO', 'LTD', 'LLC', 'PLC', 'GROUP', 'HOLDINGS',
  'INTERNATIONAL', 'TECHNOLOGIES', 'TECHNOLOGY', 'SYSTEMS', 'SERVICES', 'THE',
  'CLASS', 'COMMON', 'STOCK', 'SHARES', 'TRUST', 'AND', 'OF', 'FOR',
]);

/** Returns terms to match against news titles/descriptions for relevance filtering. */
export function buildFilterTerms(ticker: string, name: string | null): string[] {
  const terms: string[] = [ticker.toUpperCase().split('.')[0]];
  if (name) {
    const words = name
      .toUpperCase()
      .replace(/[^A-Z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    terms.push(...words);
  }
  return [...new Set(terms)];
}

/** Extracts a human-readable search phrase from a company name for the NewsAPI query. */
export function extractSearchQuery(name: string | null): string {
  if (!name) return '';
  const words = name
    .replace(
      /\b(Inc|Corp|Co|Ltd|LLC|PLC|Group|Holdings|International|Technologies|Technology|Systems|Services|The|Class)\b/gi,
      ''
    )
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return words.slice(0, 2).join(' ');
}

export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  publishedAt: string;
}

/**
 * Returns articles that mention at least one filter term.
 * Falls back to the full list when fewer than minRelevant articles match,
 * to avoid returning an empty or near-empty news feed.
 */
export function filterRelevantNews(
  articles: NewsArticle[],
  filterTerms: string[],
  minRelevant = 3
): NewsArticle[] {
  const relevant = articles.filter((a) => {
    const text = `${a.title ?? ''} ${a.description ?? ''}`.toUpperCase();
    return filterTerms.some((term) => text.includes(term));
  });
  return relevant.length >= minRelevant ? relevant : articles;
}
