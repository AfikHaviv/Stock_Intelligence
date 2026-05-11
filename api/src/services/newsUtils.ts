/**
 * Pure helpers for news-article relevance filtering.
 * Kept separate so they can be unit-tested without touching Yahoo Finance.
 */

/** Legal-suffix words that carry no identity signal. */
const STRIP_RE =
  /\b(Inc\.?|Corp\.?|Ltd\.?|Co\.?|LLC|PLC|SA|AG|NV|SE|Group|Holdings?|International|Technologies?|Systems?|Solutions?|Services?|Enterprises?|Corporation|Airlines?|Bank|Financial|Energy|Capital|Industries|Pharmaceuticals?|Biotech)\b/gi;

/**
 * Build the set of uppercase terms to look for in an article headline.
 *
 * Rules:
 * - Always include the full ticker (e.g. "ESLT.TA").
 * - For international tickers (contains "."), also add the base part ("ESLT").
 * - From the company name, strip legal suffixes and punctuation, then keep
 *   tokens that are at least 2 characters long (handles brands like "El Al").
 */
export function buildFilterTerms(
  ticker: string,
  companyName: string | null,
): string[] {
  const terms = new Set<string>();
  const upper = ticker.toUpperCase();

  terms.add(upper);

  // e.g. "ESLT.TA" → also add "ESLT"
  const dotIdx = upper.indexOf('.');
  if (dotIdx > 0) terms.add(upper.slice(0, dotIdx));

  if (companyName) {
    const tokens = companyName
      .replace(/[,'."&]/g, ' ')    // normalise punctuation first
      .replace(STRIP_RE, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 2); // 2-char min: captures "El", "Al", etc.

    tokens.forEach((t) => terms.add(t.toUpperCase()));
  }

  return [...terms];
}

/**
 * Extract a clean search query from a company name, for use as a fallback
 * when the ticker symbol yields poor Yahoo Finance search results.
 *
 * "El Al Israel Airlines Ltd." → "El Al"
 * "Apple Inc."                 → "Apple"
 * "NVIDIA Corporation"         → "NVIDIA"
 * "Tesla, Inc."                → "Tesla"
 */
export function extractSearchQuery(companyName: string): string | null {
  const tokens = companyName
    .replace(/[,'."&]/g, ' ')
    .replace(STRIP_RE, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return null;
  // Use at most the first 2 meaningful words — enough to be specific,
  // not so many that the search becomes too narrow.
  return tokens.slice(0, 2).join(' ');
}

/**
 * Return true if the article title contains at least one of the filter terms
 * at a word boundary (preceded and followed by a non-alphanumeric character).
 * This prevents e.g. "AAPL" matching "MAPLE" or "EL" matching "INTEL".
 */
export function isTitleRelevant(title: string, filterTerms: string[]): boolean {
  const upper = title.toUpperCase();
  return filterTerms.some((term) => {
    const idx = upper.indexOf(term);
    if (idx === -1) return false;
    const before = idx === 0 || !/[A-Z0-9]/.test(upper[idx - 1]);
    const after  = idx + term.length >= upper.length || !/[A-Z0-9]/.test(upper[idx + term.length]);
    return before && after;
  });
}

/**
 * Filter a list of articles down to those relevant to the ticker / company.
 * Falls back to the full unfiltered list when fewer than `minRelevant` pass
 * (handles tickers with sparse coverage, e.g. small-cap / foreign stocks).
 */
export function filterRelevantNews<T extends { title: string }>(
  articles: T[],
  filterTerms: string[],
  minRelevant = 4,
): T[] {
  const relevant = articles.filter((a) => isTitleRelevant(a.title, filterTerms));
  return relevant.length >= minRelevant ? relevant : articles;
}
