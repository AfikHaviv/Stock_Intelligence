'use client';

type StockEntry = { ticker: string; name: string };

type Props = {
  recent:    StockEntry[];
  watchlist: StockEntry[];
  activeTicker: string;
  onSelect:          (ticker: string) => void;
  onRemoveRecent:    (ticker: string) => void;
  onRemoveWatchlist: (ticker: string) => void;
};

function Chip({ entry, isActive, onSelect, onRemove }: {
  entry: StockEntry;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      title={entry.name}
      className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-mono font-medium
                  border transition-colors select-none
                  ${isActive
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500'}`}
    >
      <span className="cursor-pointer" onClick={onSelect}>{entry.ticker}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className={`ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[11px] leading-none transition-colors
                    ${isActive
                      ? 'text-blue-200 hover:bg-blue-500 hover:text-white'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        aria-label={`Remove ${entry.ticker}`}
      >
        ×
      </button>
    </div>
  );
}

export default function QuickAccess({
  recent, watchlist, activeTicker, onSelect, onRemoveRecent, onRemoveWatchlist,
}: Props) {
  if (recent.length === 0 && watchlist.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {recent.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0 w-14">
            Recent
          </span>
          {recent.map((entry) => (
            <Chip
              key={entry.ticker}
              entry={entry}
              isActive={entry.ticker === activeTicker}
              onSelect={() => onSelect(entry.ticker)}
              onRemove={() => onRemoveRecent(entry.ticker)}
            />
          ))}
        </div>
      )}
      {watchlist.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0 w-14 flex items-center gap-1">
            <span>★</span><span>Watch</span>
          </span>
          {watchlist.map((entry) => (
            <Chip
              key={entry.ticker}
              entry={entry}
              isActive={entry.ticker === activeTicker}
              onSelect={() => onSelect(entry.ticker)}
              onRemove={() => onRemoveWatchlist(entry.ticker)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
