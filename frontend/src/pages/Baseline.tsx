import { useMemo, useState } from "react";
import {
  ArrowClockwise,
  Check,
  Flask,
  Info,
  ShieldWarning,
  Sparkle,
} from "@phosphor-icons/react";
import {
  ADH1B_LABELS,
  ADH1C_LABELS,
  ALDH2_CAPACITY,
  ALDH2_LABELS,
  MEDICATION_INFO,
  computeHeadroom,
  estimateTbw,
  formatDuration,
  simulate,
  type MedicationId,
  type Profile,
} from "@wtdh/engine";
import { useStore, useNow } from "../lib/store";
import { Badge, NumberInput, Panel, Segmented, Toggle } from "../components/ui";
import { bacDisplay } from "../lib/format";

export function BaselinePage() {
  const { state, updateProfile, loadExample, resetAll } = useStore();
  const { profile } = state;
  const now = useNow();
  const [saved, setSaved] = useState(false);

  const tbw = useMemo(() => estimateTbw(profile), [profile]);
  const headroom = useMemo(() => computeHeadroom(profile, 0, now), [profile, now]);
  const probe = useMemo(() => {
    const startedAt = now;
    const grams = 14;
    return simulate({
      profile,
      session: {
        startedAt,
        drinks: [
          {
            id: "probe",
            at: startedAt,
            volumeMl: grams / 0.789 / 0.05,
            abv: 5,
            label: "One US standard drink",
          },
        ],
        meals: [],
        waters: [],
        sensors: [],
        readings: [],
      },
      at: startedAt + 60 * 60_000,
      horizonHours: 12,
      stepMinutes: 2,
    });
  }, [profile, now]);

  const update = (patch: Partial<Profile>) => {
    updateProfile((p) => ({ ...p, ...patch }));
    flash();
  };
  const updateGenetics = (patch: Partial<Profile["genetics"]>) => {
    updateProfile((p) => ({ ...p, genetics: { ...p.genetics, ...patch } }));
    flash();
  };
  const updateConditions = (patch: Partial<Profile["conditions"]>) => {
    updateProfile((p) => ({ ...p, conditions: { ...p.conditions, ...patch } }));
    flash();
  };
  const updateBaseline = (patch: Partial<Profile["baseline"]>) => {
    updateProfile((p) => ({ ...p, baseline: { ...p.baseline, ...patch } }));
    flash();
  };
  function flash() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  const aldhCapacity = ALDH2_CAPACITY[profile.genetics.aldh2];
  const selectedMeds = profile.medications
    .map((m) => MEDICATION_INFO[m])
    .filter(Boolean);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Baseline / fixed engine</div>
          <h1 className="display mt-2 text-[clamp(1.7rem,2.6vw,2.35rem)]">The body that meets the drink.</h1>
          <p className="prose-b mt-2 text-[12.5px]">
            Everything here changes the model. Body composition changes the volume; enzymes
            change the toxicity curve; medication changes the risk floor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${saved ? "badge-accent" : ""}`}>
            {saved ? <><Check size={10} /> Saved locally</> : "Auto-saved locally"}
          </span>
        </div>
      </div>

      <div className="baseline-grid">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Body composition"
            subtitle="Total body water is the volume ethanol actually enters"
            right={<Badge tone="accent">{tbw.litres.toFixed(1)} L TBW</Badge>}
            bodyClassName="panel-body"
          >
            <div className="mb-4 grid grid-cols-2 gap-4">
              <label className="field col-span-2 sm:col-span-1">
                <span>Name</span>
                <input
                  className="input"
                  value={profile.name}
                  placeholder="Your profile"
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <NumberInput label="Age" unit="years" value={profile.age} min={18} max={100} onChange={(v) => update({ age: v === "" ? 18 : v })} />
              <div className="field">
                <span>Sex at birth</span>
                <Segmented
                  ariaLabel="Sex at birth"
                  value={profile.sex}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                  onChange={(v) => update({ sex: v })}
                />
              </div>
              <NumberInput label="Height" unit="cm" value={profile.heightCm} min={120} max={230} onChange={(v) => update({ heightCm: v === "" ? 120 : v })} />
              <NumberInput label="Weight" unit="kg" value={profile.weightKg} min={35} max={300} onChange={(v) => update({ weightKg: v === "" ? 35 : v })} />
              <NumberInput
                label="Body fat"
                unit="%"
                value={profile.bodyFatPct ?? ""}
                min={3}
                max={62}
                onChange={(v) => update({ bodyFatPct: v === "" ? null : v })}
                help="Leave blank to use the Watson equation."
                className="col-span-2"
              />
            </div>

            <div className="border border-[var(--color-line)] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="label">Distribution volume</div>
                  <div className="metric mt-1 text-[30px] leading-none">
                    {tbw.litres.toFixed(1)} <span className="text-[12px] text-faint">L</span>
                  </div>
                  <div className="micro mt-1">
                    {tbw.method === "body-composition" ? "Fat-free mass hydration model" : "Watson anthropometric estimate"} · ±{tbw.standardDeviation.toFixed(1)} L
                  </div>
                </div>
                <div className="text-right">
                  <div className="label">Peak, 1 standard drink</div>
                  <div className="metric mt-1 text-[20px] leading-none text-[var(--color-accent)]">{bacDisplay(probe.summary.peakBac)}</div>
                  <div className="micro mt-1">fasted, no food</div>
                </div>
              </div>

              <div className="mt-4">
                <CompositionBar
                  lean={tbw.leanMassKg}
                  fat={tbw.fatMassKg}
                  weight={profile.weightKg}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted">
                <span><b className="font-mono text-ink">{tbw.leanMassKg?.toFixed(1) ?? "—"}</b> kg lean</span>
                <span><b className="font-mono text-ink">{tbw.fatMassKg?.toFixed(1) ?? "—"}</b> kg fat</span>
                <span><b className="font-mono text-ink">{bacDisplay(probe.summary.peakBac)}</b> g/dL peak from 14 g</span>
                <span><b className="font-mono text-ink">{formatDuration(probe.summary.clearanceAt ? (probe.summary.clearanceAt - now) / 60_000 : null)}</b> to zero</span>
              </div>
            </div>
            <p className="micro mt-3">
              Fat holds very little water. Two people at the same weight can differ by several
              litres of distribution volume, which is why weight-only BAC calculators mislead.
            </p>
          </Panel>

          <Panel
            title="Enzyme genotype"
            subtitle="ADH converts ethanol to acetaldehyde. ALDH2 clears acetaldehyde."
            right={<a className="btn btn-sm" href="#/method">How this is used</a>}
            bodyClassName="panel-body space-y-3"
          >
            <GenotypeRow
              gene="ADH1B"
              value={profile.genetics.adh1b}
              label={ADH1B_LABELS[profile.genetics.adh1b]}
              description="Faster oxidation raises the acetaldehyde peak and can make the first drink hit harder."
              options={[
                { value: "slow", label: "*1/*1" },
                { value: "intermediate", label: "*1/*2" },
                { value: "fast", label: "*2/*2" },
                { value: "unknown", label: "Unknown" },
              ]}
              onChange={(v) => updateGenetics({ adh1b: v as Profile["genetics"]["adh1b"] })}
              effect={profile.genetics.adh1b === "fast" ? "oxidation +10%" : profile.genetics.adh1b === "slow" ? "oxidation −6%" : "reference"}
            />
            <GenotypeRow
              gene="ADH1C"
              value={profile.genetics.adh1c}
              label={ADH1C_LABELS[profile.genetics.adh1c]}
              description="Changes gastric first-pass metabolism, especially when a meal is present."
              options={[
                { value: "fast", label: "*1/*1" },
                { value: "intermediate", label: "*1/*2" },
                { value: "slow", label: "*2/*2" },
                { value: "unknown", label: "Unknown" },
              ]}
              onChange={(v) => updateGenetics({ adh1c: v as Profile["genetics"]["adh1c"] })}
              effect={profile.genetics.adh1c === "fast" ? "first-pass +8%" : profile.genetics.adh1c === "slow" ? "first-pass −12%" : "reference"}
            />
            <GenotypeRow
              gene="ALDH2"
              value={profile.genetics.aldh2}
              label={ALDH2_LABELS[profile.genetics.aldh2]}
              description="The dominant determinant of acetaldehyde exposure. *2 is common in East Asian populations."
              options={[
                { value: "active", label: "*1/*1" },
                { value: "reduced", label: "*1/*2" },
                { value: "minimal", label: "*2/*2" },
                { value: "unknown", label: "Unknown" },
              ]}
              onChange={(v) => updateGenetics({ aldh2: v as Profile["genetics"]["aldh2"] })}
              effect={aldhCapacity < 1 ? `${(1 / aldhCapacity).toFixed(1)}× acetaldehyde dwell` : "full clearance"}
            />

            {aldhCapacity < 1 && (
              <div className="flex items-start gap-2.5 border-l-2 border-[var(--color-warn)] bg-[rgba(240,180,85,0.04)] px-3 py-2.5">
                <ShieldWarning size={14} weight="fill" className="mt-0.5 shrink-0 text-[var(--color-warn)]" />
                <p className="micro leading-relaxed">
                  With reduced ALDH2 capacity, the same dose produces a much higher acetaldehyde
                  peak and a higher oesophageal cancer risk over time. Flushing is a physiological
                  warning, not a tolerance to train.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Daily state" subtitle="These are dynamic. Update them before a session." bodyClassName="panel-body">
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="Typical sleep" unit="h" value={profile.baseline.sleepHours} min={0} max={14} step={0.25} onChange={(v) => updateBaseline({ sleepHours: v === "" ? 0 : v })} help="Sleep debt worsens next-day cardiovascular strain." />
              <NumberInput label="Hydration" unit="%" value={profile.baseline.hydrationPct} min={0} max={100} onChange={(v) => updateBaseline({ hydrationPct: v === "" ? 50 : v })} help="50 = normal. Dehydration concentrates ethanol." />
              <NumberInput label="Resting heart rate" unit="bpm" value={profile.baseline.restingHr} min={30} max={160} onChange={(v) => updateBaseline({ restingHr: v === "" ? 60 : v })} />
              <NumberInput label="HRV (RMSSD)" unit="ms" value={profile.baseline.hrvMs} min={1} max={300} onChange={(v) => updateBaseline({ hrvMs: v === "" ? 50 : v })} />
              <div className="field col-span-2">
                <span>Subjective stress · {profile.baseline.stress}/10</span>
                <input
                  type="range"
                  className="range"
                  min={0}
                  max={10}
                  step={1}
                  value={profile.baseline.stress}
                  onChange={(e) => updateBaseline({ stress: Number(e.target.value) })}
                  aria-label="Subjective stress from 0 to 10"
                />
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Your ceiling"
            subtitle="Personal low-risk reference for one day"
            right={<Badge tone={headroom.ceilingG === 0 ? "danger" : "accent"}>{headroom.ceilingG} g</Badge>}
            bodyClassName="panel-body"
          >
            <div className="flex items-end gap-3">
              <span className="metric text-[52px] leading-none tracking-[-0.04em]" style={{ color: headroom.ceilingG === 0 ? "var(--color-danger)" : "var(--color-ink)" }}>
                {headroom.ceilingG}
              </span>
              <span className="mb-1 text-[11px] text-faint">g ethanol / day</span>
            </div>
            <div className="mt-1.5 micro">
              ≈ {(headroom.ceilingG / 14).toFixed(1)} US drinks · {(headroom.ceilingG / 10).toFixed(1)} WHO drinks
            </div>
            <div className="mt-4 border-t border-[var(--color-line)] pt-3">
              <div className="row row-tight">
                <span className="text-[11px] text-muted">Reference</span>
                <span className="metric ml-auto text-[11px]">{headroom.referenceG} g</span>
              </div>
              {headroom.drivers.map((d) => (
                <div key={d.label} className="row row-tight">
                  <span className="min-w-0 text-[11px] text-muted">
                    {d.label}
                    <span className="micro block">{d.effect}</span>
                  </span>
                  <span className={`metric ml-auto shrink-0 text-[11px] ${d.tone === "risk" ? "text-[var(--color-warn)]" : "text-[var(--color-safe)]"}`}>×{d.multiplier.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="micro mt-3">
              This number is a harm-reduction anchor, not an allowance. It falls to zero with
              pregnancy, cirrhosis or a clinician's advice to abstain.
            </p>
          </Panel>

          <Panel title="Model output" subtitle="What your profile produces" bodyClassName="panel-body space-y-3">
            <Readout label="Distribution volume" value={`${tbw.litres.toFixed(1)} L`} note={`${tbw.method === "body-composition" ? "FFM-based" : "Watson"} · ±${tbw.standardDeviation.toFixed(1)} L`} />
            <Readout label="Acetaldehyde clearance" value={`${(aldhCapacity * 100).toFixed(0)}%`} note={aldhCapacity < 1 ? `${(1 / aldhCapacity).toFixed(1)}× longer dwell` : "reference capacity"} />
            <Readout label="First-pass, fed" value="≈15–22%" note="gastric ADH + food delay" />
            <Readout label="Peak from 14 g" value={`${bacDisplay(probe.summary.peakBac)} g/dL`} note={`${formatDuration(probe.summary.minutesToClearance)} to zero, fasted`} />
            <Readout label="90-day example" value={state.history.length ? `${state.history.reduce((s, d) => s + d.grams, 0).toFixed(0)} g` : "—"} note={state.history.length ? "logged ethanol in record" : "no history logged"} />
          </Panel>

          <Panel title="Conditions & medication" subtitle="These set hard risk floors" bodyClassName="panel-body">
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span>Liver</span>
                <select className="select" value={profile.conditions.liver} onChange={(e) => updateConditions({ liver: e.target.value as Profile["conditions"]["liver"] })}>
                  <option value="none">No known disease</option>
                  <option value="fatty">Fatty liver</option>
                  <option value="fibrosis">Fibrosis</option>
                  <option value="cirrhosis">Cirrhosis</option>
                </select>
              </label>
              <label className="field">
                <span>Diabetes</span>
                <select className="select" value={profile.conditions.diabetes} onChange={(e) => updateConditions({ diabetes: e.target.value as Profile["conditions"]["diabetes"] })}>
                  <option value="none">None</option>
                  <option value="type1">Type 1</option>
                  <option value="type2">Type 2</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {profile.sex === "female" && (
                <Toggle checked={profile.conditions.pregnancy} onChange={(v) => updateConditions({ pregnancy: v })} label="Pregnant or trying to conceive" />
              )}
            </div>

            <div className="mt-4 border-t border-[var(--color-line)] pt-3">
              <div className="label mb-2">Medications & supplements</div>
              <div className="flex max-h-[196px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                {(Object.entries(MEDICATION_INFO) as [MedicationId, (typeof MEDICATION_INFO)[MedicationId]][]).map(([id, info]) => {
                  const on = profile.medications.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="chip"
                      data-on={on}
                      onClick={() => {
                        const next = on
                          ? profile.medications.filter((m) => m !== id)
                          : [...profile.medications, id];
                        update({ medications: next });
                      }}
                    >
                      {on && <Check size={10} weight="bold" />}
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedMeds.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
                {selectedMeds.map((m) => (
                  <div key={m.label} className="flex items-start gap-2">
                    <WarningDot />
                    <p className="micro leading-relaxed"><span className="text-ink">{m.label}:</span> {m.flags[0]}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Data" subtitle="Local-first, no account" bodyClassName="panel-body">
            <div className="flex items-start gap-2">
              <Flask size={15} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
              <p className="micro">
                Your entries stay in this browser's local storage. Nothing is uploaded. Clearing
                the example replaces it with an empty profile and history.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!state.isDemo && (
                <button type="button" className="btn btn-sm" onClick={loadExample}>
                  <Sparkle size={12} /> Load example
                </button>
              )}
              <a href="#/labs" className="btn btn-sm">Enter lab panel</a>
              <button
                type="button"
                className="btn btn-sm ml-auto text-[var(--color-danger)]"
                onClick={() => {
                  if (window.confirm("Reset everything? This deletes your profile, session, labs and history from this browser.")) {
                    resetAll();
                  }
                }}
              >
                <ArrowClockwise size={12} /> Reset all
              </button>
            </div>
          </Panel>

          <div className="flex items-start gap-2 border border-[var(--color-line)] px-3 py-3">
            <Info size={14} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
            <p className="micro">
              Unknown values are treated as population reference values, never as personal
              measurements. The model's 90% band widens when it knows less.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenotypeRow({
  gene,
  value,
  label,
  description,
  options,
  onChange,
  effect,
}: {
  gene: string;
  value: string;
  label: string;
  description: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  effect: string;
}) {
  return (
    <div className="border border-[var(--color-line)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="label text-[10px] text-ink">{gene}</span>
            <span className="micro">{label}</span>
          </div>
          <p className="micro mt-1.5 max-w-[52ch]">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Segmented ariaLabel={`${gene} genotype`} value={value} options={options} onChange={onChange} />
          <span className="micro text-[var(--color-accent)]">{effect}</span>
        </div>
      </div>
    </div>
  );
}

function CompositionBar({ lean, fat, weight }: { lean: number | null; fat: number | null; weight: number }) {
  const leanPct = lean != null ? (lean / weight) * 100 : 0;
  const fatPct = fat != null ? (fat / weight) * 100 : 0;
  if (lean == null || fat == null) {
    return (
      <div className="flex h-2 w-full items-center bg-[var(--color-line)]">
        <div className="w-full px-2 text-center text-[8px] text-faint">Enter body fat % for a measured split</div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden bg-[var(--color-line)]">
        <div style={{ width: `${leanPct}%`, background: "var(--color-accent)" }} />
        <div style={{ width: `${fatPct}%`, background: "var(--color-warn)", opacity: 0.55 }} />
        <div style={{ width: `${Math.max(0, 100 - leanPct - fatPct)}%`, background: "var(--color-faint)" }} />
      </div>
      <div className="mt-1.5 flex items-center gap-4 text-[9px] text-faint">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-[var(--color-accent)]" /> Lean {leanPct.toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-[var(--color-warn)]" /> Fat {fatPct.toFixed(0)}%</span>
        <span className="ml-auto">{weight.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

function Readout({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="row row-tight">
      <div className="min-w-0">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="micro">{note}</div>
      </div>
      <span className="metric ml-auto shrink-0 text-[11.5px] text-ink">{value}</span>
    </div>
  );
}

function WarningDot() {
  return <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" />;
}
