import type { ThemeMode } from '../app/page';
import s from './StockLoader.module.css';

const LINE_PATH = 'M6 76 L20 70 L34 82 L46 62 L58 70 L70 48 L82 58 L94 30 L106 42 L118 18';

// Dark mode  → light strokes on dark bg (#f1f5f9 slate-100)
// Light mode → dark strokes on light bg (#1e293b slate-800)
const COLORS = {
  dark:  { ring: 'rgba(241,245,249,', dot: '#f1f5f9', dotGlow: 'rgba(241,245,249,', line: '#f1f5f9', lineGlow: 'rgba(241,245,249,', grid: 'rgba(241,245,249,' },
  light: { ring: 'rgba(30,41,59,',    dot: '#1e293b', dotGlow: 'rgba(30,41,59,',    line: '#1e293b', lineGlow: 'rgba(30,41,59,',    grid: 'rgba(30,41,59,' },
};

export default function StockLoader({ theme = 'dark' }: { theme?: ThemeMode }) {
  const c = COLORS[theme];
  return (
    <div className={s.stage} role="status" aria-label="Loading">
      {/* Counter-rotating whirl rings — colors injected via CSS custom properties */}
      <div
        className={s.whirl}
        style={{
          '--si-ring-hi':  `${c.ring}0.85)`,
          '--si-ring-lo':  `${c.ring}0.25)`,
          '--si-ring2-hi': `${c.ring}0.45)`,
          '--si-ring2-lo': `${c.ring}0.12)`,
        } as React.CSSProperties}
      />

      {/* Three orbital pinpricks */}
      <div className={s.orbit}>
        <span className={s.dot} style={{ width: 4, height: 4, margin: '-2px 0 0 -2px',       opacity: 1,    background: c.dot, boxShadow: `0 0 12px ${c.dotGlow}0.7)`, transform: 'rotate(  0deg) translateX(92px)' }} />
        <span className={s.dot} style={{ width: 3, height: 3, margin: '-1.5px 0 0 -1.5px',   opacity: 0.55, background: c.dot, boxShadow: `0 0 12px ${c.dotGlow}0.7)`, transform: 'rotate(140deg) translateX(92px)' }} />
        <span className={s.dot} style={{ width: 2, height: 2, margin: '-1px 0 0 -1px',       opacity: 0.30, background: c.dot, boxShadow: `0 0 12px ${c.dotGlow}0.7)`, transform: 'rotate(245deg) translateX(92px)' }} />
      </div>

      {/* Stock line inside a circular crop */}
      <div className={s.chart}>
        <svg viewBox="0 0 124 124" preserveAspectRatio="none">
          {/* Subtle grid */}
          <line stroke={`${c.grid}0.08)`} strokeWidth="1" x1="0" y1="62"  x2="124" y2="62" />
          <line stroke={`${c.grid}0.08)`} strokeWidth="1" x1="0" y1="31"  x2="124" y2="31" />
          <line stroke={`${c.grid}0.08)`} strokeWidth="1" x1="0" y1="93"  x2="124" y2="93" />

          {/* The drawing stock line */}
          <path
            className={s.line}
            d={LINE_PATH}
            style={{ stroke: c.line, filter: `drop-shadow(0 0 6px ${c.lineGlow}0.35))` }}
          />

          {/* The dot that rides the line */}
          <circle
            className={s.pulse}
            r="3.2" cx="0" cy="0"
            style={{
              fill: c.dot,
              filter: `drop-shadow(0 0 8px ${c.dotGlow}0.9))`,
              offsetPath: `path('${LINE_PATH}')`,
              offsetRotate: '0deg',
            } as React.CSSProperties}
          />
        </svg>
      </div>
    </div>
  );
}
