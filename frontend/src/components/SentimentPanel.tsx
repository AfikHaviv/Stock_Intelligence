'use client';

import type { NewsSentiment } from '../app/page';

type Props = {
  sentiment: NewsSentiment | null;
  loading: boolean;
};

const LABEL_STYLE = {
  BULLISH: { text: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', bar: 'bg-emerald-500' },
  NEUTRAL: { text: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/30',     bar: 'bg-slate-400'   },
  BEARISH: { text: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30',          bar: 'bg-red-500'     },
};

export default function SentimentPanel({ sentiment, loading }: Props) {
  if (!loading && !sentiment) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4">
      {loading && !sentiment ? (
        // Skeleton
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto" />
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ) : sentiment ? (
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              AI Sentiment
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${LABEL_STYLE[sentiment.sentiment].bg} ${LABEL_STYLE[sentiment.sentiment].text}`}>
              {sentiment.sentiment}
            </span>
            <span className="ml-auto text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums">
              {sentiment.score}/100
            </span>
          </div>

          {/* Score bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${LABEL_STYLE[sentiment.sentiment].bar}`}
              style={{ width: `${sentiment.score}%` }}
            />
          </div>

          {/* Summary */}
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {sentiment.summary}
          </p>

          {/* Attribution */}
          <p className="text-[10px] text-slate-400 dark:text-slate-600 text-right">
            Powered by ChatGPT
          </p>
        </div>
      ) : null}
    </div>
  );
}
