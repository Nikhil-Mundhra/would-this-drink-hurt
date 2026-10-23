import type { Headroom } from "@wtdh/engine";

export function HeadroomGauge({ headroom }: { headroom: Headroom }) {
  const { ceilingG, remainingG, consumedG, usedPct } = headroom;
  const over = Math.max(0, consumedG - ceilingG);
  const fill = Math.min(100, usedPct);
  const tone = fill >= 100 ? "var(--color-danger)" : fill >= 80 ? "var(--color-warn)" : "var(--color-accent)";

  return (
    <div>
      <div className="relative">
        <svg viewBox="0 0 260 146" className="w-full" role="img" aria-label={`${remainingG.toFixed(0)} grams of a ${ceilingG} gram personal reference remaining`}>
          <defs>
            <linearGradient id="headroom-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={tone} stopOpacity="0.55" />
              <stop offset="100%" stopColor={tone} stopOpacity="1" />
            </linearGradient>
          </defs>
          {Array.from({ length: 21 }).map((_, i) => {
            const a = Math.PI + (Math.PI * i) / 20;
            const r1 = 102;
            const r2 = i % 5 === 0 ? 110 : 106;
            const cx = 130;
            const cy = 126;
            return (
              <line
                key={i}
                x1={cx + Math.cos(a) * r1}
                y1={cy + Math.sin(a) * r1}
                x2={cx + Math.cos(a) * r2}
                y2={cy + Math.sin(a) * r2}
                stroke={i % 5 === 0 ? "rgba(195,242,90,0.4)" : "var(--color-line-strong)"}
                strokeWidth="1"
              />
            );
          })}
          <path
            d="M 34 126 A 96 96 0 0 1 226 126"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="11"
            strokeLinecap="butt"
          />
          <path
            d="M 34 126 A 96 96 0 0 1 226 126"
            fill="none"
            stroke="url(#headroom-fill)"
            strokeWidth="11"
            pathLength={100}
            strokeDasharray={`${fill} 100`}
            style={{ transition: "stroke-dasharray 0.6s var(--ease-out)" }}
          />
          <path
            d="M 34 126 A 96 96 0 0 1 226 126"
            fill="none"
            stroke="var(--color-canvas)"
            strokeWidth="1.5"
            strokeDasharray="1 8"
            opacity="0.55"
          />
          <text x="34" y="143" textAnchor="middle" fill="var(--color-faint)" fontSize="9" fontFamily="var(--font-mono)">
            0
          </text>
          <text x="226" y="143" textAnchor="middle" fill="var(--color-faint)" fontSize="9" fontFamily="var(--font-mono)">
            {ceilingG} g
          </text>
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-[26px] flex flex-col items-center">
          <div className="label text-[8.5px]">{over > 0 ? "over reference" : "remaining"}</div>
          <div
            className="metric mt-1 text-[34px] leading-none tracking-[-0.04em]"
            style={{ color: over > 0 ? "var(--color-danger)" : "var(--color-ink)" }}
          >
            {over > 0 ? `−${over.toFixed(0)}` : remainingG.toFixed(0)}
            <span className="ml-1 text-[14px] text-faint">g</span>
          </div>
          <div className="micro mt-1">
            {consumedG.toFixed(0)} of {ceilingG} g used
          </div>
        </div>
      </div>
      <p className="micro mt-2 text-center leading-relaxed">
        Personal low-risk reference, not a target.
        <br />
        Zero grams is the only zero-risk dose.
      </p>
    </div>
  );
}
