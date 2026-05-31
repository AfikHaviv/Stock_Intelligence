'use client';

import type { NewsArticle } from '../app/page';

interface NewsSectionProps {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 dark:border-slate-700 border-slate-200 bg-slate-800/60 dark:bg-slate-800/60 bg-white animate-pulse">
      <div className="h-[90px] bg-slate-700 dark:bg-slate-700 bg-slate-200" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-slate-700 dark:bg-slate-700 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-700 dark:bg-slate-700 bg-slate-200 rounded w-1/2" />
        <div className="h-2.5 bg-slate-700 dark:bg-slate-700 bg-slate-200 rounded w-1/4 mt-3" />
      </div>
    </div>
  );
}

export default function NewsSection({ articles, loading, error }: NewsSectionProps) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Latest News
      </h2>

      {error && (
        <p className="text-xs text-slate-500 dark:text-slate-500 py-6 text-center font-mono">
          {error}
        </p>
      )}

      {!error && !loading && articles.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-500 py-6 text-center font-mono">
          No recent news found.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.map((a) => (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl overflow-hidden border transition-colors
                           bg-slate-800/70 border-slate-700 hover:border-slate-500
                           dark:bg-slate-800/70 dark:border-slate-700 dark:hover:border-slate-500
                           bg-white border-slate-200 hover:border-slate-400
                           dark:shadow-none shadow-sm hover:shadow-md"
              >
                <div className="h-[90px] overflow-hidden bg-slate-700 dark:bg-slate-700 bg-slate-100 flex-shrink-0">
                  {a.urlToImage ? (
                    <img
                      src={a.urlToImage}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        width="36" height="36"
                        viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="text-slate-600 dark:text-slate-600 text-slate-300 opacity-60"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 p-4 gap-2">
                  <p className="text-xs font-medium leading-snug text-slate-100 dark:text-slate-100 text-slate-900 line-clamp-3
                                group-hover:text-white dark:group-hover:text-white group-hover:text-slate-700 transition-colors">
                    {a.title}
                  </p>
                  <div className="mt-auto flex items-center justify-between font-mono text-[10px] text-slate-500 dark:text-slate-500 text-slate-400">
                    <span className="truncate max-w-[60%]">{a.source}</span>
                    <div className="flex items-center gap-2">
                      {a.sentiment && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                          a.sentiment === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' :
                          a.sentiment === 'BEARISH' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
                                                      'text-slate-400 bg-slate-500/10 border-slate-500/25'
                        }`}>
                          {a.sentiment === 'BULLISH' ? 'Bullish' : a.sentiment === 'BEARISH' ? 'Bearish' : 'Neutral'}
                        </span>
                      )}
                      <span>{timeAgo(a.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
      </div>
    </section>
  );
}
