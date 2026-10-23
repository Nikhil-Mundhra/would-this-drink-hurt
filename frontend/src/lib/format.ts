import type { RiskBand } from "@wtdh/engine";

export const RISK_LABEL: Record<RiskBand, string> = {
  none: "Clear",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
};

export const RISK_EXPLANATION: Record<RiskBand, string> = {
  none: "No modelled ethanol or acetaldehyde load.",
  low: "Below the threshold where most people notice impairment.",
  moderate: "Coordination, reaction time and sleep are measurably affected.",
  high: "Clear impairment. Driving and operating machinery are unsafe.",
  "very-high": "Severe acute load. Do not drive. Seek help if breathing or consciousness changes.",
};

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export function formatDateShort(t: number | string): string {
  const d = typeof t === "string" ? new Date(`${t}T12:00:00`) : new Date(t);
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function bacDisplay(bac: number, digits = 3): string {
  if (!Number.isFinite(bac)) return "—";
  return bac.toFixed(digits);
}

export function pct(v: number, digits = 0): string {
  return `${v.toFixed(digits)}%`;
}

export function grams(v: number, digits = 0): string {
  return `${v.toFixed(digits)} g`;
}

export function plural(n: number, single: string, pluralForm = `${single}s`): string {
  return `${n} ${n === 1 ? single : pluralForm}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "W";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function todayKey(t = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function riskTone(band: RiskBand): string {
  return `tone-${band}`;
}

export function bandLabel(band: string): string {
  return band.replace(/-/g, " ");
}

export function hoursToClock(iso: number): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function relativeMinutes(target: number, now: number): string {
  const diff = Math.round((target - now) / 60_000);
  if (Math.abs(diff) < 1) return "now";
  if (diff > 0) return `in ${diff} min`;
  return `${Math.abs(diff)} min ago`;
}
