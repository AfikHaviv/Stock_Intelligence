export function currencySymbol(currency: string | null): string {
  try {
    return (
      new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD' })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? '$'
    );
  } catch {
    return '$';
  }
}

export function price(n: number | null | undefined, currency: string | null): string {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)}`;
  }
}

export function compactCap(n: number | null, currency: string | null): string {
  if (n == null) return '—';
  const sym = currencySymbol(currency);
  if (n >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${sym}${(n / 1e6).toFixed(2)}M`;
  return `${sym}${n.toLocaleString('en-US')}`;
}

export function compactVol(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}
