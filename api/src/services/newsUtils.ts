/**
 * Pure helpers for news-article relevance filtering.
 * Kept separate so they can be unit-tested without touching Yahoo Finance.
 */

/** Legal-suffix words that carry no identity signal. */
const STRIP_RE =
  /\b(Inc\.?|Corp\.?|Ltd\.?|Co\.?|LLC|PLC|SA|AG|NV|SE|Group|Holdings?|International|Technologies?|Systems?|Solutions?|Services?|Enterprises?|Corporation)\b/gi;

/**
 * Build the set of uppercase terms to look for in an article headline.
 *
 * Rules:
 * - Always include the full ticker (e.g. "ESLT.TA").
 * - For international tickers (contains "."), also add the base part ("ESLT").
 * - From the company name, strip legal suffixes and punctuation, then keep
 *   tokens that are at least 3 characters long.
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
      .replace(/[,'."]/g, ' ')   // normalise punctuation first
      .replace(STRIP_RE, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    tokens.forEach((t) => terms.add(t.toUpperCase()));
  }

  return [...terms];
}

/**
 * Return true if the article title contains at least one of the filter terms
 * as a whole-word (or parenthesised) match.
 *
 * We use a simple `.includes()` check — exact substring is fast and good
 * enough for company names / ticker symbols. A "word-ish" boundary check
 * (`\b` or surrounded by non-alphanumeric) prevents e.g. "AAPL" matching
 * "MAPLE", but in practice financial headlines are unambiguous.
 */
export function isTitleRelevant(title: string, filterTerms: string[]): boolean {
  const upper = title.toUpperCase();
  return filterTerms.some((term) => {
    const idx = upper.indexOf(term);
    if (idx === -1) return false;
    // Verify the match is at a word boundary (preceded/followed by non-alpha)
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
