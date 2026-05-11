'use client';

import Image from 'next/image';
import { ThemeMode } from '../app/page';

export interface NewsArticle {
  title:       string;
  publisher:   string;
  link:        string;
  publishedAt: string;
  imageUrl:    string | null;
}

interface Props {
  articles: NewsArticle[];
  loading:  boolean;
  ticker:   string;
  theme:    ThemeMode;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CARD = {
  dark:  'bg-slate-800/70 border-slate-700 hover:bg-slate-800',
  light: 'bg-white border-slate-200 shadow-sm hover:shadow-md',
};
const HEADING = {
  dark:  'text-slate-100',
  light: 'text-slate-900',
};
const META = {
  dark:  'text-slate-500',
  light: 'text-slate-400',
};
const PLACEHOLDER = {
  dark:  'bg-slate-700',
  light: 'bg-slate-100',
};

function SkeletonCard({ theme }: { theme: ThemeMode }) {
  const bg = theme === 'dark' ? 'bg-slate-700/60' : 'bg-slate-200';
  const card = theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200';
  return (
    <div className={`rounded-xl border overflow-hidden animate-pulse ${card}`}>
      <div className={`h-40 w-full ${bg}`} />
      <div className="p-4 space-y-2">
        <div className={`h-3 rounded ${bg} w-3/4`} />
        <div className={`h-3 rounded ${bg} w-full`} />
        <div className={`h-3 rounded ${bg} w-1/2`} />
      </div>
    </div>
  );
}

export default function NewsSection({ articles, loading, ticker, theme }: Props) {
  const h = HEADING[theme];
  const m = META[theme];

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h2 className={`text-xl font-semibold ${h}`}>Latest News</h2>
        <span className={`text-sm ${m}`}>· {ticker}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} theme={theme} />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className={`text-sm ${m}`}>No recent news found for {ticker}.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-xl border overflow-hidden flex flex-col transition-all duration-200 ${CARD[theme]}`}
            >
              {/* Image */}
              <div className={`relative h-40 w-full shrink-0 ${PLACEHOLDER[theme]}`}>
                {article.imageUrl ? (
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className={`w-10 h-10 opacity-20 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 2v6h6" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="p-4 flex flex-col flex-1 gap-2">
                <p className={`text-sm font-medium leading-snug line-clamp-3 group-hover:text-blue-400 transition-colors ${h}`}>
                  {article.title}
                </p>
                <div className={`mt-auto flex items-center justify-between text-xs ${m}`}>
                  <span className="truncate max-w-[70%]">{article.publisher}</span>
                  <span className="shrink-0">{timeAgo(article.publishedAt)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
