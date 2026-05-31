'use client';

type Props = {
  active:   string[];
  loading:  boolean;
  onToggle: (key: string) => void;
};

const MA_TOGGLES = [
  { key: 'sma20',  label: 'SMA 20',  hex: '#f59e0b' },
  { key: 'sma50',  label: 'SMA 50',  hex: '#3b82f6' },
  { key: 'sma200', label: 'SMA 200', hex: '#a855f7' },
  { key: 'ema12',  label: 'EMA 12',  hex: '#f43f5e' },
  { key: 'ema26',  label: 'EMA 26',  hex: '#14b8a6' },
];

const OSC_TOGGLES = [
  { key: 'rsi',  label: 'RSI',  hex: '#fb923c' },
  { key: 'macd', label: 'MACD', hex: '#38bdf8' },
];

function ToggleBtn({ label, hex, active, disabled, onClick }: {
  label: string; hex: string; active: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border
        ${disabled
          ? 'opacity-40 cursor-not-allowed border-transparent text-slate-400 dark:text-slate-600'
          : active
            ? 'text-white border-transparent'
            : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer'
        }`}
      style={active && !disabled ? { backgroundColor: hex, borderColor: hex } : undefined}
    >
      {label}
    </button>
  );
}

export default function IndicatorToggles({ active, loading, onToggle }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mr-1 shrink-0">
        Indicators
      </span>
      {MA_TOGGLES.map((t) => (
        <ToggleBtn
          key={t.key}
          label={t.label}
          hex={t.hex}
          active={active.includes(t.key)}
          disabled={loading}
          onClick={() => onToggle(t.key)}
        />
      ))}
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
      {OSC_TOGGLES.map((t) => (
        <ToggleBtn
          key={t.key}
          label={t.label}
          hex={t.hex}
          active={active.includes(t.key)}
          disabled={loading}
          onClick={() => onToggle(t.key)}
        />
      ))}
    </div>
  );
}
