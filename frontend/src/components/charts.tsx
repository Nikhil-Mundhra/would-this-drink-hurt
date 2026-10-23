import { sampleAt, type Sample } from "@wtdh/engine";
import { formatTime } from "../lib/format";

export function AcetaldehydeChart({
  samples,
  at,
  height = 150,
}: {
  samples: Sample[];
  at: number;
  height?: number;
}) {
  const W = 900;
  const H = height;
  const PAD = { left: 34, right: 12, top: 14, bottom: 22 };
  const HOUR = 3_600_000;
  const from = at - 3 * HOUR;
  const to = at + 4 * HOUR;
  const visible = samples.filter((s) => s.t >= from && s.t <= to);
  if (visible.length < 2) return <div className="skeleton" style={{ height: H }} />;

  const peak = Math.max(4, ...visible.map((s) => s.acetaldehydeUmolL)) * 1.15;
  const x = (t: number) => PAD.left + ((t - from) / (to - from)) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / peak) * (H - PAD.top - PAD.bottom);
  const area = `M ${x(visible[0].t)} ${H - PAD.bottom} L ${visible
    .map((s) => `${x(s.t)} ${y(s.acetaldehydeUmolL)}`)
    .join(" L ")} L ${x(visible[visible.length - 1].t)} ${H - PAD.bottom} Z`;
  const line = visible.map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t)} ${y(s.acetaldehydeUmolL)}`).join(" ");
  const current = sampleAt(samples, at);
  const peakSample = visible.reduce((a, b) => (a.acetaldehydeUmolL > b.acetaldehydeUmolL ? a : b));

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none" style={{ height: H }} role="img" aria-label={`Acetaldehyde curve, current ${current?.acetaldehydeUmolL.toFixed(1)} micromoles per litre`}>
        <defs>
          <linearGradient id="ach-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-warn)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-warn)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + f * (H - PAD.top - PAD.bottom)} y2={PAD.top + f * (H - PAD.top - PAD.bottom)} stroke="var(--color-line)" strokeDasharray="2 6" />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-line-strong)" />
        <path d={area} fill="url(#ach-area)" />
        <path d={line} fill="none" stroke="var(--color-warn)" strokeWidth="1.8" />
        <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-accent)" strokeOpacity="0.4" strokeWidth="1" />
        {current && <circle cx={x(at)} cy={y(current.acetaldehydeUmolL)} r="3.5" fill="var(--color-accent)" stroke="var(--color-canvas)" strokeWidth="1.5" />}
        <text x={x(peakSample.t)} y={y(peakSample.acetaldehydeUmolL) - 6} textAnchor="middle" fill="var(--color-warn)">
          peak {peakSample.acetaldehydeUmolL.toFixed(1)} µM
        </text>
        <text x={PAD.left} y={H - 6} fill="var(--color-faint)">{formatTime(from)}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fill="var(--color-faint)">{formatTime(to)}</text>
      </svg>
    </div>
  );
}

export function MiniMeter({
  label,
  value,
  pct,
  tone = "accent",
  caption,
}: {
  label: string;
  value: string;
  pct: number;
  tone?: "accent" | "safe" | "warn" | "danger" | "muted";
  caption?: string;
}) {
  const color =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "warn"
        ? "var(--color-warn)"
        : tone === "safe"
          ? "var(--color-safe)"
          : tone === "muted"
            ? "var(--color-faint)"
            : "var(--color-accent)";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        <span className="metric text-[12px] text-ink">{value}</span>
      </div>
      <div className="mt-2 h-[3px] w-full bg-[var(--color-line)]">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }}
        />
      </div>
      {caption && <div className="micro mt-1.5">{caption}</div>}
    </div>
  );
}

export function TrendSparkline({
  data,
  height = 48,
  tone = "var(--color-accent)",
}: {
  data: number[];
  height?: number;
  tone?: string;
}) {
  const W = 300;
  const H = height;
  if (data.length < 2) return <div className="skeleton" style={{ height: H }} />;
  const max = Math.max(...data, 1);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none" style={{ height: H }} aria-hidden="true">
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill={tone} opacity="0.07" />
      <path d={path} fill="none" stroke={tone} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
