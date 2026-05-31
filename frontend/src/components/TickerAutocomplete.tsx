'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Suggestion {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

interface TickerAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (ticker: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function TickerAutocomplete({ value, onChange, onSubmit }: TickerAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const justPickedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await fetch(`${API_URL}/api/stocks/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
        setHighlightIdx(-1);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, fetchSuggestions]);

  function pick(ticker: string) {
    justPickedRef.current = true;
    onChange(ticker);
    setSuggestions([]);
    setOpen(false);
    onSubmit(ticker);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0) {
        pick(suggestions[highlightIdx].ticker);
      } else {
        setOpen(false);
        if (value.trim()) onSubmit(value.trim());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative flex-1 max-w-sm">
      <input
        type="text"
        placeholder="Search ticker (e.g. AAPL)"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors
                   bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500
                   dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500
                   bg-white border-slate-300 text-slate-900 placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="characters"
        suppressHydrationWarning
      />

      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border overflow-hidden
                       bg-slate-800 border-slate-700
                       dark:bg-slate-800 dark:border-slate-700
                       bg-white border-slate-200
                       shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
          {suggestions.map((s, i) => (
            <li
              key={`${s.ticker}-${s.exchange}`}
              onMouseDown={() => pick(s.ticker)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm
                          ${i === highlightIdx
                            ? 'bg-slate-700 dark:bg-slate-700 bg-slate-100'
                            : 'hover:bg-slate-700/60 dark:hover:bg-slate-700/60 hover:bg-slate-50'}`}
            >
              <span className="font-mono font-semibold text-slate-100 dark:text-slate-100 text-slate-900 w-14 shrink-0">
                {s.ticker}
              </span>
              <span className="text-slate-400 dark:text-slate-400 text-slate-500 text-xs truncate flex-1">
                {s.name}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0
                               bg-slate-600/60 text-slate-300
                               dark:bg-slate-600/60 dark:text-slate-300
                               bg-slate-100 text-slate-500">
                {s.exchange}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
