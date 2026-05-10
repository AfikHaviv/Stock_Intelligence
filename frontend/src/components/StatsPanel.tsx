import { PriceRow, ThemeMode } from '../app/page';
import { price, compactCap, compactVol } from '../utils/statsUtils';

export interface LiveStats {
  name:             string | null;
  exchangeName:     string | null;
  currency:         string | null;
  marketCap:        number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow:  number | null;
  volume:           number | null;
}

interface Props {
  dailyData: PriceRow[];
  stats:     LiveStats | null;
  theme:     ThemeMode;
}


const CARD = {
  dark:  'bg-slate-800/60 border-slate-700',
  light: 'bg-white border-slate-200 shadow-sm',
};

const LABEL = { dark: 'text-slate-500', light: 'text-slate-400' };
const VALUE = { dark: 'text-slate-100', light: 'text-slate-800' };

function StatCard({ label, value, theme }: { label: string; value: string; theme: ThemeMode }) {
  return (
    <div className={`rounded-lg px-4 py-3 border ${CARD[theme]}`}>
      <p className={`text-xs uppercase tracking-wider mb-1 ${LABEL[theme]}`}>{label}</p>
      <p className={`font-semibold text-sm ${VALUE[theme]}`}>{value}</p>
    </div>
  );
}

export default function StatsPanel({ dailyData, stats, theme }: Props) {
  const cur          = stats?.currency ?? null;
  const last         = dailyData.length ? dailyData[dailyData.length - 1] : null;
  const lastOpen     = last?.open  ?? null;
  const lastClose    = last?.close ?? null;
  const highestClose = dailyData.length ? Math.max(...dailyData.map((r) => r.close)) : null;

  const weekRange =
    stats?.fiftyTwoWeekLow != null && stats?.fiftyTwoWeekHigh != null
      ? `${price(stats.fiftyTwoWeekLow, cur)} – ${price(stats.fiftyTwoWeekHigh, cur)}`
      : '—';

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <StatCard label="Open"          value={price(lastOpen, cur)}              theme={theme} />
      <StatCard label="Last Close"    value={price(lastClose, cur)}             theme={theme} />
      <StatCard label="Highest Close" value={price(highestClose, cur)}          theme={theme} />
      <StatCard label="Market Cap"    value={compactCap(stats?.marketCap ?? null, cur)} theme={theme} />
      <StatCard label="52-Week Range" value={weekRange}                          theme={theme} />
      <StatCard label="Total Volume"  value={compactVol(stats?.volume ?? null)}  theme={theme} />
    </div>
  );
}
