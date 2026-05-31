export default function StockLoader() {
  return (
    <div className="flex items-center justify-center h-96">
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="text-slate-400 dark:text-slate-500"
        aria-label="Loading"
      >
        <defs>
          <clipPath id="inner-crop">
            <circle cx="100" cy="100" r="54" />
          </clipPath>
          <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <path
            id="stock-path"
            d="M 46 148 L 62 130 L 76 140 L 94 112 L 108 98 L 124 108 L 138 82 L 152 70 L 160 52"
          />
        </defs>

        {/* Faint outer ring */}
        <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.15" />

        {/* Clockwise arc */}
        <circle
          cx="100" cy="100" r="76"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray="62 416"
          opacity="0.65"
          style={{ transformOrigin: '100px 100px', animation: 'loader-spin-cw 2.2s linear infinite' }}
        />

        {/* Counter-clockwise arc */}
        <circle
          cx="100" cy="100" r="76"
          fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"
          strokeDasharray="30 416"
          opacity="0.35"
          style={{ transformOrigin: '100px 100px', animation: 'loader-spin-ccw 3.6s linear infinite' }}
        />

        {/* Three orbital pinpricks */}
        {([0, 120, 240] as const).map((deg, i) => (
          <g key={i} transform="translate(100,100)">
            <circle
              cx="0" cy="-76" r="2.5"
              fill="currentColor" opacity="0.45"
              style={{
                transformOrigin: '0px 0px',
                transform: `rotate(${deg}deg)`,
                animation: `loader-orbit 4s linear infinite`,
                animationDelay: `${(i * 4) / 3}s`,
              }}
            />
          </g>
        ))}

        {/* Stock line inside clipped circle */}
        <g clipPath="url(#inner-crop)">
          <use href="#stock-path" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Glowing dot riding the line */}
          <circle r="4" fill="currentColor" filter="url(#dot-glow)">
            <animateMotion
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.85;1"
              keyPoints="0;1;1"
              keySplines="0.4 0 0.2 1; 0 0 1 1"
            >
              <mpath href="#stock-path" />
            </animateMotion>
          </circle>
        </g>
      </svg>
    </div>
  );
}
