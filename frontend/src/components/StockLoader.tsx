import s from './StockLoader.module.css';

const LINE_PATH = 'M6 76 L20 70 L34 82 L46 62 L58 70 L70 48 L82 58 L94 30 L106 42 L118 18';

export default function StockLoader() {
  return (
    <div className={s.stage} role="status" aria-label="Loading">
      {/* Counter-rotating whirl rings */}
      <div className={s.whirl} />

      {/* Three orbital pinpricks */}
      <div className={s.orbit}>
        <span className={s.dot} style={{ width: 4, height: 4, margin: '-2px 0 0 -2px', opacity: 1,    transform: 'rotate(  0deg) translateX(92px)' }} />
        <span className={s.dot} style={{ width: 3, height: 3, margin: '-1.5px 0 0 -1.5px', opacity: 0.55, transform: 'rotate(140deg) translateX(92px)' }} />
        <span className={s.dot} style={{ width: 2, height: 2, margin: '-1px 0 0 -1px', opacity: 0.30, transform: 'rotate(245deg) translateX(92px)' }} />
      </div>

      {/* Stock line inside a circular crop */}
      <div className={s.chart}>
        <svg viewBox="0 0 124 124" preserveAspectRatio="none">
          {/* Subtle grid */}
          <line className={s.grid} x1="0" y1="62"  x2="124" y2="62" />
          <line className={s.grid} x1="0" y1="31"  x2="124" y2="31" />
          <line className={s.grid} x1="0" y1="93"  x2="124" y2="93" />

          {/* The drawing stock line */}
          <path className={s.line} d={LINE_PATH} />

          {/* The dot that rides the line */}
          <circle
            className={s.pulse}
            r="3.2" cx="0" cy="0"
            style={{
              offsetPath: `path('${LINE_PATH}')`,
              offsetRotate: '0deg',
            } as React.CSSProperties}
          />
        </svg>
      </div>
    </div>
  );
}
