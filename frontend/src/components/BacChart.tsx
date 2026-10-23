import { useMemo, useRef, useState } from "react";
import { sampleAt, type SimulationResult, type Session } from "@wtdh/engine";
import { bacDisplay, formatTime } from "../lib/format";

const W = 900;
const H = 300;
const PAD = { left: 46, right: 18, top: 30, bottom: 32 };
const HOUR = 3_600_000;

function nearestIndex(samples: SimulationResult["samples"], t: number): number {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(samples[lo - 1].t - t) < Math.abs(samples[lo].t - t)) return lo - 1;
  return lo;
}

export function BacChart({
  result,
  session,
  at,
}: {
  result: SimulationResult;
  session: Session;
  at: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const { samples, summary } = result;

  const geometry = useMemo(() => {
    const firstDrink = session.drinks.length ? Math.min(...session.drinks.map((d) => d.at)) : session.startedAt;
    const lastDrink = session.drinks.length ? Math.max(...session.drinks.map((d) => d.at)) : session.startedAt;
    const from = Math.max(
      samples[0].t,
      Math.min(at - 1.5 * HOUR, firstDrink - 20 * 60_000, session.startedAt - 20 * 60_000),
    );
    const to = Math.min(
      samples[samples.length - 1].t,
      Math.max(at + 2.5 * HOUR, summary.clearanceAt ?? 0, lastDrink + 3.5 * HOUR, from + 3 * HOUR),
    );
    const visible = samples.filter((s) => s.t >= from && s.t <= to);
    const peak = Math.max(
      ...visible.map((s) => Math.max(s.bac, s.bacHigh ?? s.bac)),
      summary.currentBac,
      0.02,
    );
    const yMax = Math.max(0.06, Math.ceil((peak * 1.22) / 0.01) * 0.01);
    const x = (t: number) => PAD.left + ((t - from) / (to - from)) * (W - PAD.left - PAD.right);
    const y = (v: number) => H - PAD.bottom - (Math.max(0, v) / yMax) * (H - PAD.top - PAD.bottom);
    return { from, to, visible, yMax, x, y };
  }, [samples, session, at, summary]);

  const { from, to, visible, yMax, x, y } = geometry;

  const line = visible.map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${y(s.bac).toFixed(1)}`).join(" ");
  const band = visible.length
    ? `M ${visible.map((s) => `${x(s.t).toFixed(1)} ${y(s.bacHigh ?? s.bac).toFixed(1)}`).join(" L ")} L ${[...visible]
        .reverse()
        .map((s) => `${x(s.t).toFixed(1)} ${y(s.bacLow ?? s.bac).toFixed(1)}`)
        .join(" L ")} Z`
    : "";

  const nowX = x(at);
  const current = sampleAt(samples, at);

  const xTicks = useMemo(() => {
    const span = to - from;
    const step = span > 9 * HOUR ? 2 * HOUR : HOUR;
    const first = Math.ceil(from / step) * step;
    const out: number[] = [];
    for (let t = first; t <= to; t += step) out.push(t);
    return out;
  }, [from, to]);

  const yTicks = useMemo(() => {
    const step = yMax <= 0.1 ? 0.02 : yMax <= 0.2 ? 0.05 : 0.1;
    const out: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) out.push(Number(v.toFixed(2)));
    return out;
  }, [yMax]);

  const hovered = hoverT != null ? sampleAt(samples, hoverT) : null;
  const hoveredX = hoverT != null ? x(hoverT) : 0;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = from + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (to - from);
    if (t < from || t > to) {
      setHoverT(null);
      return;
    }
    const idx = nearestIndex(samples, t);
    setHoverT(samples[idx].t);
  }

  const events = [
    ...session.drinks.map((d) => ({ ...d, kind: "drink" as const })),
    ...session.meals.map((m) => ({ ...m, kind: "meal" as const })),
    ...session.waters.map((w) => ({ ...w, kind: "water" as const })),
  ].filter((e) => e.at >= from && e.at <= to);

  const bandTone = summary.riskBand;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverT(null)}
        onPointerDown={handleMove}
        role="img"
        aria-label={`Blood alcohol curve. Current ${bacDisplay(summary.currentBac)} grams per decilitre, projected peak ${bacDisplay(summary.peakBac)}.`}
        tabIndex={0}
        onFocus={() => setHoverT(at)}
        onBlur={() => setHoverT(null)}
      >
        <defs>
          <linearGradient id="bac-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.11" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="bac-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9dc93f" />
            <stop offset="55%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="#e0ff9a" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? "var(--color-line-strong)" : "var(--color-line)"}
              strokeDasharray={v === 0 ? undefined : "2 5"}
            />
            <text x={PAD.left - 10} y={y(v) + 3.5} textAnchor="end">
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {yTicks.includes(0.05) && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(0.05)} y2={y(0.05)} stroke="rgba(240,180,85,0.4)" strokeDasharray="5 4" />
            <text x={W - PAD.right} y={y(0.05) - 5} textAnchor="end" fill="rgba(240,180,85,0.75)">
              0.05 · most of Europe
            </text>
          </g>
        )}
        {yTicks.includes(0.08) && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(0.08)} y2={y(0.08)} stroke="rgba(255,112,92,0.35)" strokeDasharray="5 4" />
            <text x={W - PAD.right} y={y(0.08) - 5} textAnchor="end" fill="rgba(255,112,92,0.7)">
              0.08 · US limit
            </text>
          </g>
        )}

        {band && <path d={band} fill="url(#bac-band)" />}

        <path d={line} fill="none" stroke="url(#bac-line)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {visible.some((s) => s.t > at) && (
          <path
            d={visible
              .filter((s) => s.t >= at - 60_000)
              .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${y(s.bac).toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.55"
            strokeWidth="1.6"
            strokeDasharray="5 5"
          />
        )}

        <line x1={nowX} x2={nowX} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="var(--color-accent)" strokeOpacity="0.45" strokeWidth="1" />
        <text x={nowX + 5} y={PAD.top - 10} fill="var(--color-accent)" fontSize="9" fontWeight="600">
          NOW
        </text>

        {current && (
          <g>
            <circle cx={x(at)} cy={y(current.bac)} r="4.5" fill="var(--color-accent)" stroke="var(--color-canvas)" strokeWidth="2" />
          </g>
        )}

        {events.map((e) => {
          const ex = x(e.at);
          const color = e.kind === "drink" ? "var(--color-accent)" : e.kind === "meal" ? "var(--color-warn)" : "var(--color-faint)";
          return (
            <g key={`${e.kind}-${e.id}`}>
              <line x1={ex} x2={ex} y1={PAD.top - 3} y2={H - PAD.bottom} stroke={color} strokeOpacity="0.16" strokeDasharray="1 5" />
              {e.kind === "drink" ? (
                <path d={`M ${ex} ${PAD.top - 14} l 4 7 h -8 z`} fill={color} />
              ) : (
                <rect x={ex - 2} y={PAD.top - 11} width="4" height="4" fill={color} opacity={e.kind === "meal" ? 0.9 : 0.6} />
              )}
              <title>
                {e.kind === "drink" ? (e as { label: string }).label : e.kind === "meal" ? "Meal" : "Water"} · {formatTime(e.at)}
              </title>
            </g>
          );
        })}

        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 10} textAnchor="middle">
            {formatTime(t)}
          </text>
        ))}

        {hovered && (
          <g>
            <line x1={hoveredX} x2={hoveredX} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-ink)" strokeOpacity="0.35" strokeDasharray="2 3" />
            <circle cx={hoveredX} cy={y(hovered.bac)} r="3.5" fill="var(--color-ink)" />
            <circle cx={hoveredX} cy={y(hovered.bacHigh ?? hovered.bac)} r="2" fill="var(--color-accent)" opacity="0.5" />
            <circle cx={hoveredX} cy={y(hovered.bacLow ?? hovered.bac)} r="2" fill="var(--color-accent)" opacity="0.5" />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="chart-tip"
          style={{
            left: `clamp(56px, ${(hoveredX / W) * 100}%, calc(100% - 56px))`,
            transform: "translateX(-50%)",
            top: 6,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="label">{formatTime(hovered.t)}</span>
            <span className={`label tone-${bandTone}`}>{summary.riskBand}</span>
          </div>
          <div className="metric mt-1.5 text-[19px] leading-none">
            {bacDisplay(hovered.bac)} <span className="text-[9px] text-faint">g/dL</span>
          </div>
          <div className="mt-1 text-[9px] text-faint">
            90% band {bacDisplay(hovered.bacLow ?? hovered.bac)}–{bacDisplay(hovered.bacHigh ?? hovered.bac)}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-4 text-[10px]">
            <span className="text-muted">Acetaldehyde</span>
            <span className="metric text-ink">{hovered.acetaldehydeUmolL.toFixed(1)} µM</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-4 text-[10px]">
            <span className="text-muted">Impairment index</span>
            <span className="metric text-ink">{hovered.impairment.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
