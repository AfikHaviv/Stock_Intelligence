'use client';

import { useEffect, useRef, useState } from 'react';
import { ThemeMode } from '../app/page';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Suggestion {
  ticker:   string;
  name:     string | null;
  exchange: string | null;
  type:     string | null;
}

interface Props {
  value:          string;
  onChange:       (v: string) => void;
  onSelect:       (ticker: string) => void;
  theme:          ThemeMode;
  inputClassName: string;
  placeholder?:   string;
}

export default function TickerAutocomplete({
  value, onChange, onSelect, theme, inputClassName, placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen]               = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Debounced fetch whenever the input value changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (!q) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stocks/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
        setActiveIdx(-1);
      } catch {
        // silently ignore — autocomplete is best-effort
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      // A suggestion is highlighted → select it instead of submitting the form
      e.preventDefault();
      pick(suggestions[activeIdx].ticker);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  function pick(ticker: string) {
    onChange(ticker);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    onSelect(ticker);
  }

  // Theme-aware styles
  const dropBg     = theme === 'dark'
    ? 'bg-slate-800 border-slate-700 shadow-2xl'
    : 'bg-white border-slate-200 shadow-xl';
  const itemBase   = 'flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors';
  const itemHover  = theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-50';
  const itemHl     = theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100';
  const nameColor  = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const exchBg     = theme === 'dark'
    ? 'bg-slate-600/60 text-slate-300'
    : 'bg-slate-100 text-slate-500';
  const tickerColor = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';

  return (
    <div className="relative flex-1 max-w-xs">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onBlur={() => {
          // Delay so a mousedown on a suggestion fires before we close
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder ?? 'e.g. AAPL'}
        autoComplete="off"
        spellCheck={false}
        suppressHydrationWarning
        className={`w-full ${inputClassName}`}
      />

      {open && (
        <ul
          className={`absolute z-50 mt-1 w-full rounded-lg border overflow-y-auto max-h-72 ${dropBg}`}
          // Prevent the input's onBlur from firing before onClick
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.ticker}
              onClick={() => pick(s.ticker)}
              className={`${itemBase} ${itemHover} ${i === activeIdx ? itemHl : ''}`}
            >
              <span className={`font-mono font-semibold w-20 shrink-0 ${tickerColor}`}>{s.ticker}</span>
              <span className={`truncate min-w-0 ${nameColor}`}>{s.name ?? '—'}</span>
              {s.exchange && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded shrink-0 ${exchBg}`}>
                  {s.exchange}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
