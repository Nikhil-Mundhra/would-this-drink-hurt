import { useMemo, useState } from "react";
import {
  ArrowClockwise,
  BeerStein,
  CaretDown,
  Drop,
  ForkKnife,
  Info,
  Martini,
  Plus,
  Trash,
  WarningCircle,
  Wine,
} from "@phosphor-icons/react";
import {
  ALDH2_CAPACITY,
  bacUnits,
  formatDuration,
  sampleAt,
  type Drink,
  type SimulationResult,
} from "@wtdh/engine";
import { useStore, useNow } from "../lib/store";
import { useSimulation } from "../lib/useSimulation";
import {
  bacDisplay,
  formatTime,
  grams,
  pct,
  RISK_EXPLANATION,
  RISK_LABEL,
  riskTone,
} from "../lib/format";
import { DRINK_PRESETS, QUICK_WATER, type DrinkPreset } from "../lib/data";
import { Badge, NumberInput, Panel, Stat, Toggle } from "../components/ui";
import { HeadroomGauge } from "../components/HeadroomGauge";
import { BacChart } from "../components/BacChart";
import { AcetaldehydeChart, MiniMeter } from "../components/charts";

const KIND_ICON = {
  beer: BeerStein,
  wine: Wine,
  cocktail: Martini,
  spirit: Martini,
};

export function SessionPage() {
  const { state, now, addDrink, removeDrink, addWater, addMeal, removeMeal, resetSession, addSensor } = useStore();
  const { profile, session } = state;
  const [offset, setOffset] = useState(0);
  const at = now + offset * 60_000;
  const result = useSimulation(at);
  const { summary } = result;
  const current = sampleAt(result.samples, at) ?? result.samples[0];

  const action = nextAction(result, offset);
  const lastDrink = useMemo(
    () => [...session.drinks].sort((a, b) => b.at - a.at)[0],
    [session.drinks],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Session / {new Date(at).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="display mt-2 text-[clamp(1.7rem,2.6vw,2.35rem)]">The curve, not the guess.</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (session.drinks.length === 0 || window.confirm("Start a new session? Today's logged drinks will be cleared.")) {
                resetSession();
                setOffset(0);
              }
            }}
          >
            <ArrowClockwise size={12} /> New session
          </button>
        </div>
      </div>

      <div className="session-grid">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="instrument p-4 md:p-5">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`dot ${offset === 0 ? "dot-live" : ""}`} style={offset !== 0 ? { background: "var(--color-warn)" } : undefined} />
                  <span className="label text-[10px] text-muted">
                    {offset === 0 ? "Blood alcohol · live model" : `Projection · ${formatTime(at)}`}
                  </span>
                  {offset !== 0 && <Badge tone="warn">+{offset} min</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`hero-bac metric ${riskTone(summary.riskBand)}`} style={{ color: summary.riskBand === "none" ? "var(--color-ink)" : undefined }}>
                    {bacDisplay(summary.currentBac)}
                  </span>
                  <span className="label text-[10px]">g/dL</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="metric text-[11px] text-faint">
                    {bacUnits(summary.currentBac).mmolL.toFixed(1)} mmol/L · {bacUnits(summary.currentBac).permille.toFixed(2)} ‰
                  </span>
                  <Badge tone={summary.riskBand === "none" ? "neutral" : summary.riskBand === "low" ? "safe" : summary.riskBand === "moderate" ? "warn" : "danger"}>
                    {RISK_LABEL[summary.riskBand]} load
                  </Badge>
                </div>
                <p className="mt-3 max-w-[46ch] text-[12px] leading-relaxed text-muted">
                  {RISK_EXPLANATION[summary.riskBand]}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 border border-[var(--color-line)] px-2.5 py-1.5">
                  <span className="label text-[8.5px]">90% model range</span>
                  <span className="metric text-[11px] text-ink">
                    {bacDisplay(summary.confidence.bacLow)} – {bacDisplay(summary.confidence.bacHigh)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-[var(--color-line)]">
                <div className="bg-[var(--color-surface)] p-3">
                  <div className="label">Peak</div>
                  <div className="metric mt-1 text-[20px] leading-none">{bacDisplay(summary.peakBac)}</div>
                  <div className="micro mt-1">{summary.peakBac > 0 ? formatTime(summary.peakBacAt) : "—"}</div>
                </div>
                <div className="bg-[var(--color-surface)] p-3">
                  <div className="label">Zero in</div>
                  <div className="metric mt-1 text-[20px] leading-none">{formatDuration(summary.minutesToClearance)}</div>
                  <div className="micro mt-1">{summary.clearanceAt ? formatTime(summary.clearanceAt) : "No active dose"}</div>
                </div>
                <div className="bg-[var(--color-surface)] p-3">
                  <div className="label">Ethanol</div>
                  <div className="metric mt-1 text-[20px] leading-none">{summary.totalEthanolG.toFixed(0)}<span className="ml-1 text-[11px] text-faint">g</span></div>
                  <div className="micro mt-1">{summary.standardDrinks.toFixed(1)} US drinks</div>
                </div>
                <div className="bg-[var(--color-surface)] p-3">
                  <div className="label">Acetaldehyde</div>
                  <div className="metric mt-1 text-[20px] leading-none">{summary.currentAcetaldehydeUmolL.toFixed(1)}</div>
                  <div className="micro mt-1">µmol/L · peak {summary.acetaldehydePeak.toFixed(1)}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 border-l-2 border-[var(--color-accent)] bg-[rgba(195,242,90,0.035)] px-3.5 py-3">
              <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <div className="text-[12px] font-medium text-ink">{action.title}</div>
                <p className="mt-0.5 max-w-[76ch] text-[11.5px] leading-relaxed text-muted">{action.body}</p>
                {action.secondary && <p className="micro mt-1">{action.secondary}</p>}
              </div>
            </div>
          </section>

          <Panel
            title="Blood alcohol projection"
            subtitle="Solid line: modelled history. Dashed: projected clearance. Shaded: 90% uncertainty from body water and absorption."
            right={<TimeScrubber offset={offset} setOffset={setOffset} at={at} />}
            bodyClassName="px-3 pb-3 pt-2"
          >
            <BacChart result={result} session={session} at={at} />
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--color-line)] px-1 pt-3">
              <Legend color="var(--color-accent)" label="Drink" shape="tri" />
              <Legend color="var(--color-warn)" label="Meal" />
              <Legend color="var(--color-faint)" label="Water" />
              <span className="ml-auto micro">Hover the curve to inspect any minute.</span>
            </div>
            <p className="micro mt-2 px-1">
              Legal limits are shown for context only. Impairment begins below 0.05 g/dL, and
              no model can certify you to drive.
            </p>
          </Panel>

          <div className="two-col">
            <Panel
              title="Acetaldehyde exposure"
              subtitle={`ALDH2 ${profile.genetics.aldh2 === "reduced" ? "*1/*2 · reduced clearance" : profile.genetics.aldh2 === "minimal" ? "*2/*2 · minimal clearance" : "*1/*1 · full clearance"}`}
              right={<Badge tone={summary.acetaldehydePeak > 20 ? "danger" : summary.acetaldehydePeak > 9 ? "warn" : "safe"}>{summary.acetaldehydePeak.toFixed(1)} µM peak</Badge>}
              bodyClassName="px-2 pb-2 pt-2"
            >
              <AcetaldehydeChart samples={result.samples} at={at} height={150} />
              <div className="border-t border-[var(--color-line)] px-2 pt-3">
                <p className="micro leading-relaxed">
                  {profile.genetics.aldh2 === "reduced" || profile.genetics.aldh2 === "minimal"
                    ? `Your ALDH2 capacity is modelled at ${(ALDH2_CAPACITY[profile.genetics.aldh2] * 100).toFixed(0)}% of normal, so acetaldehyde stays elevated roughly ${(1 / ALDH2_CAPACITY[profile.genetics.aldh2]).toFixed(1)}× longer. Flushing and tachycardia are direct signals of that exposure, not a sign to push through.`
                    : "With full ALDH2 activity, acetaldehyde peaks briefly and falls as ethanol is oxidised. It is still a Group 1 carcinogen, and repeated high peaks matter over years."}
                </p>
              </div>
            </Panel>

            <Panel
              title="Physiological load"
              subtitle="Estimated from current BAC, acetaldehyde and your baseline."
              bodyClassName="panel-body space-y-5"
            >
              <MiniMeter
                label="Cardiovascular strain"
                value={`+${summary.cardiovascularPeakHrDelta} bpm`}
                pct={(summary.cardiovascularPeakHrDelta / 30) * 100}
                tone={summary.cardiovascularPeakHrDelta > 18 ? "danger" : summary.cardiovascularPeakHrDelta > 9 ? "warn" : "safe"}
                caption={`Predicted HRV suppression ${pct(summary.predictedHrvDropPct)} vs baseline ${profile.baseline.hrvMs} ms`}
              />
              <MiniMeter
                label="Hypoglycaemia risk"
                value={pct(summary.hypoglycemiaPeak)}
                pct={summary.hypoglycemiaPeak}
                tone={summary.hypoglycemiaPeak > 60 ? "danger" : summary.hypoglycemiaPeak > 30 ? "warn" : "safe"}
                caption={
                  profile.conditions.diabetes !== "none" || profile.medications.some((m) => m === "insulin" || m === "sulfonylurea")
                    ? "Glucose-lowering medication or diabetes raises overnight risk. Eat and monitor."
                    : "Hepatic glucose release is suppressed while ethanol is being oxidised."
                }
              />
              <MiniMeter
                label="Sleep architecture"
                value={`−${summary.estimatedRemSuppressionPct}% REM`}
                pct={(summary.estimatedRemSuppressionPct / 80) * 100}
                tone={summary.estimatedRemSuppressionPct > 35 ? "danger" : summary.estimatedRemSuppressionPct > 18 ? "warn" : "safe"}
                caption={`Sleeping at this BAC is projected to cost ${Math.abs(summary.predictedSleepHrDelta).toFixed(1)} h of restorative sleep.`}
              />
            </Panel>
          </div>

          <Telemetry
            result={result}
            at={at}
            addSensor={addSensor}
            profileName={profile.name}
            lastDrinkAt={lastDrink?.at ?? null}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Metabolic headroom"
            subtitle="Personal reference, recalculated from your profile"
            right={<Badge tone={summary.headroom.remainingG <= 0 ? "danger" : summary.headroom.usedPct > 70 ? "warn" : "safe"}>{summary.headroom.remainingG <= 0 ? "Exceeded" : `${summary.headroom.remainingG.toFixed(0)} g left`}</Badge>}
            bodyClassName="panel-body pt-3"
          >
            <HeadroomGauge headroom={summary.headroom} />
            <div className="mt-4 space-y-0">
              <div className="row row-tight">
                <span className="text-[11px] text-muted">Population reference</span>
                <span className="metric ml-auto text-[11px]">{summary.headroom.referenceG} g</span>
              </div>
              <div className="row row-tight">
                <span className="text-[11px] text-muted">Personalised</span>
                <span className="metric ml-auto text-[11px] text-ink">{summary.headroom.ceilingG} g</span>
              </div>
              <div className="row row-tight">
                <span className="text-[11px] text-muted">Logged today</span>
                <span className="metric ml-auto text-[11px]">{summary.headroom.consumedG.toFixed(0)} g</span>
              </div>
            </div>
            {summary.headroom.drivers.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
                <div className="label">Largest modifiers</div>
                {summary.headroom.drivers.slice(0, 4).map((d) => (
                  <div key={d.label + d.effect} className="flex items-start gap-2">
                    <span className="metric mt-[1px] w-9 shrink-0 text-[10px] text-faint">×{d.multiplier.toFixed(2)}</span>
                    <div className="min-w-0">
                      <div className="text-[10.5px] text-ink">{d.label}</div>
                      <div className="micro">{d.effect}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <AddDrink onAdd={addDrink} />

          <Panel title="Context" subtitle="Food and fluid change absorption and volume of distribution" bodyClassName="panel-body pt-3">
            <MealComposer onAdd={addMeal} meals={session.meals} onRemove={removeMeal} />
            <div className="mt-4 border-t border-[var(--color-line)] pt-3">
              <div className="flex items-center justify-between">
                <div className="label">Water</div>
                <span className="micro">{current.hydration.toFixed(0)}% hydration</span>
              </div>
              <div className="mt-2 flex gap-2">
                {QUICK_WATER.map((ml) => (
                  <button key={ml} type="button" className="btn btn-sm flex-1" onClick={() => addWater(ml)}>
                    <Drop size={11} /> {ml}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            title="Tonight's log"
            subtitle={`${session.drinks.length} ${session.drinks.length === 1 ? "drink" : "drinks"} · ${grams(summary.totalEthanolG)} ethanol`}
            right={<span className="badge">{summary.standardDrinks.toFixed(1)} std</span>}
            bodyClassName="panel-body pt-1"
          >
            {session.drinks.length === 0 ? (
              <div className="py-5">
                <p className="text-[12px] text-muted">No drinks logged.</p>
                <p className="micro mt-1">The clock starts with your first entry. Measure the pour when you can.</p>
              </div>
            ) : (
              <div>
                {[...session.drinks].reverse().map((d) => {
                  const g = (d.volumeMl * d.abv * 0.789) / 100;
                  return (
                    <div key={d.id} className="row row-tight group">
                      <span className="metric w-10 shrink-0 text-[10px] text-faint">{formatTime(d.at)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11.5px] text-ink">{d.label}</div>
                        <div className="micro">{d.volumeMl} ml · {d.abv}% · {g.toFixed(1)} g</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon opacity-60 group-hover:opacity-100"
                        aria-label={`Remove ${d.label}`}
                        onClick={() => removeDrink(d.id)}
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Legend({ color, label, shape }: { color: string; label: string; shape?: "tri" }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted">
      {shape === "tri" ? (
        <span style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `6px solid ${color}` }} />
      ) : (
        <span style={{ width: 6, height: 6, background: color }} />
      )}
      {label}
    </span>
  );
}

function TimeScrubber({
  offset,
  setOffset,
  at,
}: {
  offset: number;
  setOffset: (n: number) => void;
  at: number;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="label text-[8px]">{offset === 0 ? "LIVE" : formatTime(at)}</span>
        <button type="button" className="btn btn-sm" onClick={() => setOffset(0)} disabled={offset === 0}>
          Now
        </button>
      </div>
      <input
        className="range w-[132px]"
        type="range"
        min={-120}
        max={240}
        step={5}
        value={offset}
        onChange={(e) => setOffset(Number(e.target.value))}
        aria-label="Project the model forward or back in time"
      />
      <div className="flex w-[132px] justify-between text-[8px] text-faint">
        <span>−2h</span>
        <span>+4h</span>
      </div>
    </div>
  );
}

function AddDrink({ onAdd }: { onAdd: (d: Omit<Drink, "id" | "at">) => void }) {
  const [custom, setCustom] = useState(false);
  const [volume, setVolume] = useState<number | "">(330);
  const [abv, setAbv] = useState<number | "">(5);
  const [label, setLabel] = useState("Custom drink");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function add(preset: DrinkPreset) {
    onAdd({ volumeMl: preset.volumeMl, abv: preset.abv, label: `${preset.label}, ${preset.volumeMl} ml`, carbonated: preset.carbonated });
    setJustAdded(preset.id);
    window.setTimeout(() => setJustAdded(null), 900);
  }

  return (
    <Panel
      title="Add a drink"
      subtitle="Measured pour, not a guess"
      bodyClassName="panel-body pt-3"
    >
      <div className="grid grid-cols-2 gap-2">
        {DRINK_PRESETS.map((preset) => {
          const Icon = KIND_ICON[preset.kind];
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => add(preset)}
              className="group relative flex items-start gap-2 border border-[var(--color-line)] p-2.5 text-left transition-colors hover:border-[var(--color-accent-dim)] hover:bg-[rgba(195,242,90,0.04)] active:translate-y-px"
            >
              <Icon size={17} className="mt-0.5 shrink-0 text-[var(--color-faint)] group-hover:text-[var(--color-accent)]" />
              <span className="min-w-0">
                <span className="block text-[11.5px] text-ink">{justAdded === preset.id ? "Logged" : preset.label}</span>
                <span className="micro block">{preset.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className="btn btn-ghost mt-2 w-full justify-between px-1" onClick={() => setCustom((v) => !v)} aria-expanded={custom}>
        <span className="flex items-center gap-1.5 text-[11px]"><Plus size={11} /> Custom pour</span>
        <CaretDown size={11} className={custom ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {custom && (
        <div className="mt-2 space-y-2 border-t border-[var(--color-line)] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Volume" unit="ml" value={volume} min={1} max={3000} onChange={setVolume} />
            <NumberInput label="ABV" unit="%" value={abv} min={0} max={96} step={0.1} onChange={setAbv} />
          </div>
          <label className="field">
            <span>Label</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </label>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!volume || !abv}
            onClick={() => {
              if (!volume || !abv) return;
              onAdd({ volumeMl: volume, abv, label: label || "Custom drink" });
              setCustom(false);
            }}
          >
            Log {volume} ml at {abv}%
          </button>
        </div>
      )}
    </Panel>
  );
}

function MealComposer({
  onAdd,
  meals,
  onRemove,
}: {
  onAdd: (m: { size: "snack" | "meal" | "large"; fat: "low" | "medium" | "high"; protein: "low" | "medium" | "high" }) => void;
  meals: { id: string; at: number; size: string; fat: string; protein: string }[];
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<"snack" | "meal" | "large">("meal");
  const [fat, setFat] = useState<"low" | "medium" | "high">("medium");
  const [protein, setProtein] = useState<"low" | "medium" | "high">("medium");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="label flex items-center gap-1.5"><ForkKnife size={11} /> Food</div>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
          <Plus size={11} /> Log meal
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2.5 border border-[var(--color-line)] p-2.5">
          <div className="field">
            <span>Size</span>
            <div className="seg w-full">
              {(["snack", "meal", "large"] as const).map((s) => (
                <button key={s} type="button" data-on={size === s} onClick={() => setSize(s)} className="flex-1">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Fat</span>
            <div className="seg w-full">
              {(["low", "medium", "high"] as const).map((s) => (
                <button key={s} type="button" data-on={fat === s} onClick={() => setFat(s)} className="flex-1">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Protein</span>
            <div className="seg w-full">
              {(["low", "medium", "high"] as const).map((s) => (
                <button key={s} type="button" data-on={protein === s} onClick={() => setProtein(s)} className="flex-1">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              onAdd({ size, fat, protein });
              setOpen(false);
            }}
          >
            Log meal
          </button>
        </div>
      )}

      {meals.length > 0 ? (
        <div className="mt-2">
          {[...meals].reverse().slice(0, 3).map((m) => (
            <div key={m.id} className="row row-tight">
              <span className="metric w-10 shrink-0 text-[10px] text-faint">{formatTime(m.at)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] capitalize text-ink">{m.size} · {m.fat} fat · {m.protein} protein</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove meal" onClick={() => onRemove(m.id)}>
                <Trash size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="micro mt-2">No meal logged. Fasted absorption peaks faster and higher.</p>
      )}
    </div>
  );
}

function Telemetry({
  result,
  at,
  addSensor,
  profileName,
  lastDrinkAt,
}: {
  result: SimulationResult;
  at: number;
  addSensor: (s: { heartRate?: number; hrvMs?: number; glucoseMgDl?: number }) => void;
  profileName: string;
  lastDrinkAt: number | null;
}) {
  const { state, addReading } = useStore();
  const [open, setOpen] = useState(false);
  const [hr, setHr] = useState<number | "">("");
  const [hrv, setHrv] = useState<number | "">("");
  const [glucose, setGlucose] = useState<number | "">("");
  const [bacInput, setBacInput] = useState<number | "">("");
  const sensors = [...state.session.sensors].sort((a, b) => b.at - a.at);
  const latest = sensors[0];
  const latestReading = [...state.session.readings].sort((a, b) => b.at - a.at)[0];
  const sample = sampleAt(result.samples, at);

  return (
    <section className="panel">
      <button
        type="button"
        className="panel-head w-full text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h2 className="panel-title">Telemetry &amp; measured checks</h2>
          <p className="panel-sub">Wearable values are optional. They calibrate the model, they do not replace it.</p>
        </div>
        <div className="flex items-center gap-2">
          {latest && <Badge tone="accent">{sensors.length} readings</Badge>}
          <CaretDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </div>
      </button>

      {open && (
        <div className="panel-body">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="label mb-2">Log a measurement</div>
              <div className="grid grid-cols-3 gap-2">
                <NumberInput label="HR" unit="bpm" value={hr} onChange={setHr} min={30} max={220} />
                <NumberInput label="HRV" unit="ms" value={hrv} onChange={setHrv} min={1} max={300} />
                <NumberInput label="Glucose" unit="mg/dL" value={glucose} onChange={setGlucose} min={20} max={600} />
              </div>
              <button
                type="button"
                className="btn btn-sm mt-2 w-full"
                disabled={!hr && !hrv && !glucose}
                onClick={() => {
                  addSensor({
                    heartRate: hr === "" ? undefined : hr,
                    hrvMs: hrv === "" ? undefined : hrv,
                    glucoseMgDl: glucose === "" ? undefined : glucose,
                  });
                  setHr("");
                  setHrv("");
                  setGlucose("");
                }}
              >
                <Plus size={11} /> Save reading
              </button>
              <p className="micro mt-2">
                A single spot reading is noisy. Trend against your own baseline ({profileName || "profile"} · {state.profile.baseline.hrvMs} ms HRV).
              </p>
            </div>

            <div>
              <div className="label mb-2">Latest comparison</div>
              {latest ? (
                <div className="space-y-1.5">
                  <CompareRow label="Heart rate" measured={latest.heartRate != null ? `${latest.heartRate} bpm` : null} modelled={sample ? `+${sample.heartRateDelta.toFixed(0)} bpm` : "—"} time={formatTime(latest.at)} />
                  <CompareRow label="HRV" measured={latest.hrvMs != null ? `${latest.hrvMs} ms` : null} modelled={sample ? `−${sample.hrvSuppressionPct.toFixed(0)}%` : "—"} time={formatTime(latest.at)} />
                  <CompareRow label="Glucose" measured={latest.glucoseMgDl != null ? `${latest.glucoseMgDl} mg/dL` : null} modelled={sample ? `${sample.hypoglycemiaRisk.toFixed(0)}% risk` : "—"} time={formatTime(latest.at)} />
                </div>
              ) : (
                <p className="micro">
                  No readings yet. Add one from a smartwatch or CGM to compare measured strain
                  against the modelled strain. Simulated data is never inserted on your behalf.
                </p>
              )}
              {latestReading && (
                <div className="mt-3 border-t border-[var(--color-line)] pt-2">
                  <div className="label mb-1">Breathalyser check</div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{latestReading.source} · {formatTime(latestReading.at)}</span>
                    <span className="metric text-ink">{bacDisplay(latestReading.bac)}</span>
                  </div>
                  <div className="micro mt-1">
                    Model at that moment: {bacDisplay(sampleAt(result.samples, latestReading.at)?.bac ?? 0)} g/dL
                  </div>
                </div>
              )}
              <div className="mt-3 border-t border-[var(--color-line)] pt-3">
                <div className="label mb-2">Calibrate with a breathalyser</div>
                <div className="flex items-end gap-2">
                  <NumberInput
                    label="Measured BAC"
                    unit="g/dL"
                    value={bacInput}
                    min={0}
                    max={0.6}
                    step={0.001}
                    onChange={setBacInput}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!bacInput}
                    onClick={() => {
                      if (!bacInput) return;
                      addReading(bacInput, "Breathalyser");
                      setBacInput("");
                    }}
                  >
                    Save
                  </button>
                </div>
                <p className="micro mt-2">
                  A reading never changes logged doses. It records how far the model and the
                  device disagree so you can see the drift.
                </p>
              </div>
              <p className="micro mt-3 flex items-start gap-1.5">
                <Info size={11} className="mt-0.5 shrink-0" />
                {lastDrinkAt ? `Last drink logged at ${formatTime(lastDrinkAt)}. Transdermal sensors lag blood concentration.` : "No active session."}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CompareRow({ label, measured, modelled, time }: { label: string; measured: string | null; modelled: string; time: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-line)] pb-1.5 last:border-0">
      <span className="w-[74px] shrink-0 text-[10.5px] text-muted">{label}</span>
      <span className="metric text-[10.5px] text-ink">{measured ?? "not logged"}</span>
      <span className="micro ml-auto">model {modelled}</span>
      <span className="micro w-10 text-right">{time}</span>
    </div>
  );
}

function nextAction(result: SimulationResult, offset: number): { title: string; body: string; secondary?: string } {
  const { summary, samples } = result;
  const current = sampleAt(samples, summary.at);
  const drinks = result.summary.headroom.consumedG > 0;

  if (offset !== 0) {
    return {
      title: `Projected state at ${new Date(summary.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      body: `Blood alcohol is modelled at ${bacDisplay(summary.currentBac)} g/dL. The projection assumes no further drinks, food or water.`,
      secondary: "Move the scrubber back to live to log another drink.",
    };
  }

  if (!drinks || !current) {
    return {
      title: "Start with the measured dose.",
      body: "Log the first drink before you take it. The model needs volume and ABV, not a category. A 175 ml pour of 13.5% wine is 18.7 g of ethanol.",
      secondary: "Hydration, food and your ALDH2 status are already loaded from baseline.",
    };
  }

  if (current.bac >= 0.15) {
    return {
      title: "Stop drinking. This is a high acute load.",
      body: "At this concentration, coordination, breathing and gag reflex are meaningfully impaired. Stay with someone, lie on your side if sleeping, and do not drive.",
      secondary: "If breathing slows, consciousness fades, or you cannot be woken, call emergency services.",
    };
  }

  if (summary.headroom.remainingG <= 0) {
    return {
      title: "You are past your personal reference.",
      body: `Your load is ${summary.headroom.consumedG.toFixed(0)} g against a ${summary.headroom.ceilingG} g reference. Switch to water for the rest of the session. The reference is not a safety threshold; it is the point where the modelled load stops being trivial for you.`,
      secondary: `Estimated ${formatDuration(summary.minutesToClearance)} until ethanol clears.`,
    };
  }

  const aldh = result.summary.drivers.find((d) => d.label.startsWith("ALDH2"));
  if (aldh && current.acetaldehydeUmolL >= 9) {
    return {
      title: "Acetaldehyde is accumulating.",
      body: "Your genotype clears this metabolite slowly. Flushing, headache and a racing heart are signs of exposure, not signs of a weak drink. Pause, eat, and switch to water.",
      secondary: `Modelled acetaldehyde ${current.acetaldehydeUmolL.toFixed(1)} µmol/L.`,
    };
  }

  if (summary.at < summary.peakBacAt && current.absorptionGPerH > current.oxidationGPerH) {
    const minutes = Math.max(5, Math.round((summary.peakBacAt - summary.at) / 60_000));
    return {
      title: `Absorption is outpacing clearance. Pause ${minutes} min.`,
      body: "Another drink now stacks on top of ethanol that has not reached your blood yet. Waiting until the curve turns keeps the peak lower than drinking through it.",
      secondary: `Current rise: ${current.absorptionGPerH.toFixed(1)} g/h in, ${current.oxidationGPerH.toFixed(1)} g/h out.`,
    };
  }

  if (current.hydration < 45) {
    return {
      title: "Replace 500 ml of fluid.",
      body: "Low plasma volume raises the concentration of the same ethanol dose and worsens next-day headache. Water does not speed clearance, but it changes the volume ethanol is diluted into.",
      secondary: "Add electrolytes if you have been sweating or vomiting.",
    };
  }

  if (current.bac < 0.02 && summary.clearanceAt) {
    return {
      title: "Your BAC is below the impairment threshold.",
      body: "Ethanol is largely cleared, but sleep architecture and HRV can stay suppressed for hours. Do not treat a low number as a full recovery.",
      secondary: `Estimated acetaldehyde ${current.acetaldehydeUmolL.toFixed(1)} µmol/L. Sleep loss: ${summary.estimatedRemSuppressionPct}% REM.`,
    };
  }

  return {
    title: "Hold the current pace.",
    body: "Clearance is keeping up with absorption. Keep water within reach, eat if you have not, and set a stop time before the next drink.",
    secondary: `${summary.standardDrinks.toFixed(1)} US standard drinks logged · ${summary.headroom.remainingG.toFixed(0)} g left in the reference.`,
  };
}
