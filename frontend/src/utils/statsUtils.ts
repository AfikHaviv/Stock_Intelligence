/** Formats a number as a currency string; returns "—" for null/undefined. */
export function price(n: number | null | undefined, currency = 'USD'): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Compact volume formatter: 82345678 → "82.3M" */
export function compactVol(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Compact market-cap formatter (defined but not currently rendered — free plan has no market cap). */
export function compactCap(n: number | null | undefined, currency = 'USD'): string {
  if (n == null) return '—';
  if (n >= 1e12) return `${price(n / 1e12, currency)}T`;
  if (n >= 1e9) return `${price(n / 1e9, currency)}B`;
  if (n >= 1e6) return `${price(n / 1e6, currency)}M`;
  return price(n, currency);
}
