import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, WarningCircle } from "@phosphor-icons/react";
import {
  ALDH2_LABELS,
  MEDICATION_INFO,
  type MedicationId,
  type Profile,
} from "@wtdh/engine";
import { useStore, defaultProfile } from "../lib/store";
import { NumberInput, Segmented, Toggle } from "../components/ui";

type Step = 0 | 1 | 2 | 3;

export function Onboarding() {
  const { completeOnboarding } = useStore();
  const [step, setStep] = useState<Step>(0);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const updateGenetics = (patch: Partial<Profile["genetics"]>) =>
    setProfile((p) => ({ ...p, genetics: { ...p.genetics, ...patch } }));
  const updateConditions = (patch: Partial<Profile["conditions"]>) =>
    setProfile((p) => ({ ...p, conditions: { ...p.conditions, ...patch } }));
  const updateBaseline = (patch: Partial<Profile["baseline"]>) =>
    setProfile((p) => ({ ...p, baseline: { ...p.baseline, ...patch } }));

  const bodyValid = useMemo(() => {
    return (
      profile.age >= 18 &&
      profile.age <= 100 &&
      profile.heightCm >= 120 &&
      profile.heightCm <= 230 &&
      profile.weightKg >= 35 &&
      profile.weightKg <= 300 &&
      (profile.bodyFatPct == null || (profile.bodyFatPct >= 3 && profile.bodyFatPct <= 62))
    );
  }, [profile]);

  function next() {
    if (step === 1 && !bodyValid) {
      setError("Check age, height, weight and body-fat values. Ages 18+ only.");
      return;
    }
    setError(null);
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }

  function finish() {
    if (!bodyValid) {
      setError("Check your body measurements before continuing.");
      setStep(1);
      return;
    }
    completeOnboarding(profile, false);
  }

  return (
    <div className="onboard">
      <section className="onboard-left">
        <div className="onboard-grid" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <div className="brand-word">WTDH</div>
              <div className="brand-sub">metabolic model / 001</div>
            </div>
          </div>

          <h1 className="display mt-14 max-w-[12ch] text-[clamp(2.6rem,5.2vw,4.6rem)]">
            How much will this drink actually cost you?
          </h1>
          <p className="prose-b mt-6 max-w-[44ch]">
            A BAC number is only a guess about a body it has never met. This instrument
            reads your distribution volume, ALDH2 clearance, meal timing, hydration and
            liver markers, then projects the load hour by hour.
          </p>
        </div>

        <div className="relative mt-12 grid gap-0 border-y border-[var(--color-line)] sm:grid-cols-3">
          {[
            ["Distribution", "Fat-free mass", "Total body water, not body weight"],
            ["Clearance", "Michaelis–Menten", "Saturable hepatic oxidation"],
            ["Toxicity", "Acetaldehyde", "The metabolite that does the damage"],
          ].map(([k, v, d]) => (
            <div key={k} className="border-b border-[var(--color-line)] py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
              <div className="label">{k}</div>
              <div className="mt-1.5 font-mono text-[13px] text-ink">{v}</div>
              <div className="micro mt-1">{d}</div>
            </div>
          ))}
        </div>

        <div className="relative mt-8 flex items-start gap-2 text-[10px] text-faint">
          <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
          No account. Everything you enter stays in this browser. The model is educational and
          cannot decide whether you are fit to drive.
        </div>
      </section>

      <section className="onboard-right">
        <div className="onboard-card">
          {step === 0 && (
            <div className="reveal">
              <div className="label">Start here</div>
              <h2 className="display mt-3 text-[34px]">Build your baseline</h2>
              <p className="prose-b mt-3 text-[13px]">
                Six inputs do most of the work: body composition, ALDH2 status, recent food,
                hydration, liver health and the dose itself. Everything else is refinement.
              </p>

              <div className="mt-8 flex flex-col gap-2.5">
                <button type="button" className="btn btn-primary w-full justify-between px-4 py-3" onClick={() => setStep(1)}>
                  Use my data
                  <ArrowRight size={15} weight="bold" />
                </button>
                <button
                  type="button"
                  className="btn w-full justify-between px-4 py-3"
                  onClick={() => completeOnboarding(profile, true)}
                >
                  Explore with example data
                  <span className="font-mono text-[9px] text-faint">SAM, 33</span>
                </button>
              </div>

              <div className="mt-8 border-t border-[var(--color-line)] pt-5">
                <div className="flex items-start gap-2.5">
                  <WarningCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-warn)]" />
                  <p className="micro max-w-[42ch]">
                    This is a physiological model, not a medical device or a breathalyser.
                    It cannot establish fitness to drive. If you take sedatives, have liver
                    disease, or are pregnant, the correct answer is to discuss drinking with
                    a clinician.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step > 0 && (
            <div className="reveal">
              <div className="step-track" aria-hidden="true">
                <span data-on={step >= 1} />
                <span data-on={step >= 2} />
                <span data-on={step >= 3} />
              </div>

              {step === 1 && (
                <>
                  <div className="label">01 / Body</div>
                  <h2 className="display mt-3 text-[30px]">Where the alcohol goes</h2>
                  <p className="prose-b mt-2 text-[12.5px]">
                    Ethanol distributes into water, not fat. Body-fat percentage switches the
                    model from a population formula to your measured lean mass.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <label className="field col-span-2">
                      <span>Name</span>
                      <input
                        className="input"
                        value={profile.name}
                        placeholder="Optional"
                        onChange={(e) => update({ name: e.target.value })}
                      />
                    </label>
                    <NumberInput label="Age" unit="years" value={profile.age} min={18} max={100} onChange={(v) => update({ age: v === "" ? 0 : v })} />
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
                      <span className="field-help">Used for body-water and enzyme reference values.</span>
                    </div>
                    <NumberInput label="Height" unit="cm" value={profile.heightCm} min={120} max={230} onChange={(v) => update({ heightCm: v === "" ? 0 : v })} />
                    <NumberInput label="Weight" unit="kg" value={profile.weightKg} min={35} max={300} onChange={(v) => update({ weightKg: v === "" ? 0 : v })} />
                    <NumberInput
                      label="Body fat"
                      unit="%"
                      value={profile.bodyFatPct ?? ""}
                      min={3}
                      max={62}
                      onChange={(v) => update({ bodyFatPct: v === "" ? null : v })}
                      help="From a DEXA scan or smart scale. Leave blank to use Watson."
                      className="col-span-2"
                    />
                  </div>
                  <p className="micro mt-4">
                    If body fat is unknown the model uses the Watson equation, which is typically
                    within ±9% of measured total body water.
                  </p>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="label">02 / Enzymes</div>
                  <h2 className="display mt-3 text-[30px]">Your two bottlenecks</h2>
                  <p className="prose-b mt-2 text-[12.5px]">
                    ADH turns ethanol into acetaldehyde. ALDH2 clears it. The second step is where
                    most of the acute toxicity lives. If you have not been tested, leave these unknown.
                  </p>

                  <div className="mt-6 space-y-5">
                    <GenotypeBlock
                      title="ADH1B"
                      description="Controls how fast ethanol becomes acetaldehyde. The *2 allele is faster."
                      value={profile.genetics.adh1b}
                      options={[
                        { value: "slow", label: "*1/*1" },
                        { value: "intermediate", label: "*1/*2" },
                        { value: "fast", label: "*2/*2" },
                        { value: "unknown", label: "Unknown" },
                      ]}
                      onChange={(v) => updateGenetics({ adh1b: v as Profile["genetics"]["adh1b"] })}
                    />
                    <GenotypeBlock
                      title="ADH1C"
                      description="Modifies gastric first-pass metabolism, especially with food."
                      value={profile.genetics.adh1c}
                      options={[
                        { value: "fast", label: "*1/*1" },
                        { value: "intermediate", label: "*1/*2" },
                        { value: "slow", label: "*2/*2" },
                        { value: "unknown", label: "Unknown" },
                      ]}
                      onChange={(v) => updateGenetics({ adh1c: v as Profile["genetics"]["adh1c"] })}
                    />
                    <GenotypeBlock
                      title="ALDH2"
                      description={ALDH2_LABELS[profile.genetics.aldh2]}
                      value={profile.genetics.aldh2}
                      options={[
                        { value: "active", label: "*1/*1" },
                        { value: "reduced", label: "*1/*2" },
                        { value: "minimal", label: "*2/*2" },
                        { value: "unknown", label: "Unknown" },
                      ]}
                      onChange={(v) => updateGenetics({ aldh2: v as Profile["genetics"]["aldh2"] })}
                    />
                  </div>

                  {profile.genetics.aldh2 === "unknown" && (
                    <p className="micro mt-4">
                      Unknown ALDH2 is treated as fully active. This can understate risk for people
                      of East Asian descent, where *2 is common. A genotype test resolves it.
                    </p>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div className="label">03 / Context</div>
                  <h2 className="display mt-3 text-[30px]">What else is competing</h2>
                  <p className="prose-b mt-2 text-[12.5px]">
                    The liver handles alcohol, drugs and glucose through overlapping pathways.
                    These inputs change both the reference dose and the warning flags.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <label className="field">
                      <span>Liver status</span>
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
                    <NumberInput label="Typical sleep" unit="h" value={profile.baseline.sleepHours} min={0} max={14} step={0.25} onChange={(v) => updateBaseline({ sleepHours: v === "" ? 0 : v })} />
                    <NumberInput label="Hydration" unit="%" value={profile.baseline.hydrationPct} min={0} max={100} onChange={(v) => updateBaseline({ hydrationPct: v === "" ? 50 : v })} help="50 = normal, 20 = dehydrated." />
                    <div className="col-span-2">
                      {profile.sex === "female" && (
                        <Toggle
                          checked={profile.conditions.pregnancy}
                          onChange={(v) => updateConditions({ pregnancy: v })}
                          label="Pregnant or trying to conceive"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="label mb-2">Medications & supplements</div>
                    <div className="flex max-h-[152px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                      {(Object.entries(MEDICATION_INFO) as [MedicationId, (typeof MEDICATION_INFO)[MedicationId]][]).map(([id, info]) => {
                        const on = profile.medications.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            className="chip"
                            data-on={on}
                            onClick={() =>
                              update({
                                medications: on
                                  ? profile.medications.filter((m) => m !== id)
                                  : [...profile.medications, id],
                              })
                            }
                          >
                            {on && <Check size={10} weight="bold" />}
                            {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="micro mt-4">
                    This is not a complete interaction database. Tell a pharmacist about every
                    medicine you take, including anything bought over the counter.
                  </p>
                </>
              )}

              {error && <p className="mt-4 text-[11px] text-[var(--color-danger)]">{error}</p>}

              <div className="mt-7 flex items-center justify-between gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}>
                  <ArrowLeft size={13} /> Back
                </button>
                {step < 3 ? (
                  <button type="button" className="btn btn-primary" onClick={next}>
                    Continue <ArrowRight size={13} weight="bold" />
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={finish}>
                    Enter instrument <ArrowRight size={13} weight="bold" />
                  </button>
                )}
              </div>

              {step === 2 && (
                <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => setStep(3)}>
                  I don't have genetic data
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function GenotypeBlock({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="border border-[var(--color-line)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label text-[10px] text-ink">{title}</div>
        <Segmented ariaLabel={`${title} genotype`} value={value} options={options} onChange={onChange} />
      </div>
      <p className="micro mt-2">{description}</p>
    </div>
  );
}
