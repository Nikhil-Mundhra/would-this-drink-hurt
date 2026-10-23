/**
 * Shared domain types for the Would This Drink Hurt metabolic model.
 *
 * The model is deliberately explicit about what is measured, what is inferred,
 * and what is only an estimate. Anything that cannot be measured by a consumer
 * device is surfaced with an uncertainty band rather than a false point value.
 */

export type Sex = "male" | "female";

/** ADH1B phenotype. *2 carriers oxidise ethanol to acetaldehyde faster. */
export type Adh1b = "slow" | "intermediate" | "fast" | "unknown";
/** ADH1C phenotype. *2 homozygotes are slower at gastric first-pass oxidation. */
export type Adh1c = "fast" | "intermediate" | "slow" | "unknown";
/** ALDH2 phenotype. *2 carriers clear acetaldehyde slowly. */
export type Aldh2 = "active" | "reduced" | "minimal" | "unknown";

export type LiverStatus = "none" | "fatty" | "fibrosis" | "cirrhosis";
export type DiabetesStatus = "none" | "type1" | "type2";

export type MedicationId =
  | "acetaminophen"
  | "ssri"
  | "antihistamine"
  | "benzodiazepine"
  | "opioid"
  | "nsaid"
  | "insulin"
  | "sulfonylurea"
  | "statin"
  | "ppi"
  | "oralContraceptive"
  | "warfarin"
  | "methotrexate";

export interface LabPanel {
  collectedAt?: string;
  /** Phosphatidylethanol, ng/mL. Clinical exposure marker, half-life 4-10 days. */
  pethNgMl?: number | null;
  /** Gamma-glutamyl transferase, U/L. */
  ggtUaL?: number | null;
  /** Aspartate aminotransferase, U/L. */
  astUaL?: number | null;
  /** Alanine aminotransferase, U/L. */
  altUaL?: number | null;
  /** Platelets, 10^9/L. */
  plateletsKUl?: number | null;
  ferritinNgMl?: number | null;
  triglyceridesMgDl?: number | null;
  uricAcidMgDl?: number | null;
  hba1cPct?: number | null;
}

export interface BaselineState {
  /** Resting heart rate at rest, bpm. */
  restingHr: number;
  /** Baseline HRV (RMSSD), milliseconds. */
  hrvMs: number;
  /** Typical nightly sleep, hours. */
  sleepHours: number;
  /** Subjective hydration, 0-100 (50 = normal). */
  hydrationPct: number;
  /** Subjective stress, 0-10. */
  stress: number;
  /** Minutes of moderate activity per week. */
  weeklyExerciseMinutes: number;
}

export interface Conditions {
  liver: LiverStatus;
  diabetes: DiabetesStatus;
  hypertension: boolean;
  pregnancy: boolean;
}

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  /** DEXA or smart-scale body fat percentage. Null means Watson fallback. */
  bodyFatPct: number | null;
  genetics: {
    adh1b: Adh1b;
    adh1c: Adh1c;
    aldh2: Aldh2;
  };
  conditions: Conditions;
  medications: MedicationId[];
  baseline: BaselineState;
  labs: LabPanel | null;
}

export interface Drink {
  id: string;
  /** Epoch milliseconds. */
  at: number;
  volumeMl: number;
  abv: number;
  label: string;
  carbonated?: boolean;
}

export interface Meal {
  id: string;
  at: number;
  size: "snack" | "meal" | "large";
  fat: "low" | "medium" | "high";
  protein: "low" | "medium" | "high";
}

export interface WaterEvent {
  id: string;
  at: number;
  volumeMl: number;
}

export interface SensorSample {
  at: number;
  heartRate?: number;
  hrvMs?: number;
  glucoseMgDl?: number;
  skinTempC?: number;
  /** True when the sample is generated for demonstration, never passed off as real. */
  simulated?: boolean;
}

export interface BacReading {
  at: number;
  /** g/dL, as reported by a breathalyser. */
  bac: number;
  source: string;
}

export interface Session {
  startedAt: number;
  drinks: Drink[];
  meals: Meal[];
  waters: WaterEvent[];
  sensors: SensorSample[];
  readings: BacReading[];
}

export interface DailyLog {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  grams: number;
  standardDrinks: number;
  sleepHours?: number;
  restingHr?: number;
  hrvMs?: number;
  note?: string;
}

export interface Sample {
  /** Epoch ms. */
  t: number;
  /** Blood alcohol concentration, g/dL. */
  bac: number;
  /** Lower bound of the 90% model band, g/dL. */
  bacLow?: number;
  /** Upper bound of the 90% model band, g/dL. */
  bacHigh?: number;
  /** Ethanol remaining in the stomach, grams. */
  stomachG: number;
  /** Ethanol in the gut lumen, grams. */
  gutG: number;
  /** Ethanol in the body (distributed), grams. */
  bodyG: number;
  /** Modelled acetaldehyde concentration, µmol/L. */
  acetaldehydeUmolL: number;
  /** Hepatic oxidation rate, grams per hour. */
  oxidationGPerH: number;
  /** Absorption rate into systemic circulation, grams per hour. */
  absorptionGPerH: number;
  hydration: number;
  heartRateDelta: number;
  hrvSuppressionPct: number;
  hypoglycemiaRisk: number;
  sleepPressure: number;
  impairment: number;
  headroomG: number;
  calories: number;
}

export interface Driver {
  label: string;
  effect: string;
  /** Relative multiplier applied to the reference ceiling. */
  multiplier: number;
  tone: "neutral" | "protective" | "risk";
}

export interface Headroom {
  /** Personalised low-risk reference for one day, grams of ethanol. */
  ceilingG: number;
  /** Unadjusted population reference, grams. */
  referenceG: number;
  consumedG: number;
  remainingG: number;
  usedPct: number;
  /** Resets at local midnight of the supplied time. */
  resetsAt: number;
  drivers: Driver[];
}

export type RiskBand = "none" | "low" | "moderate" | "high" | "very-high";

export interface Confidence {
  bacLow: number;
  bacHigh: number;
  /** One-sigma TBW uncertainty, litres. */
  tbwSdL: number;
}

export interface SessionSummary {
  at: number;
  totalEthanolG: number;
  standardDrinks: number;
  peakBac: number;
  peakBacAt: number;
  currentBac: number;
  currentAcetaldehydeUmolL: number;
  acetaldehydePeak: number;
  peakAcetaldehydeAt: number;
  /** First time after the last drink at which BAC falls below 0.02 g/dL. */
  impairmentClearedAt: number | null;
  /** First time after the last drink at which BAC is effectively zero (<0.001). */
  clearanceAt: number | null;
  minutesToImpairmentClear: number | null;
  minutesToClearance: number | null;
  headroom: Headroom;
  riskBand: RiskBand;
  estimatedRemSuppressionPct: number;
  predictedSleepHrDelta: number;
  predictedHrvDropPct: number;
  hypoglycemiaPeak: number;
  cardiovascularPeakHrDelta: number;
  confidence: Confidence;
  /** Drivers behind the current state, ordered by contribution. */
  drivers: Driver[];
}

export interface SimulationInput {
  profile: Profile;
  session: Session;
  /** Evaluation clock. Curves are projected past this point. */
  at: number;
  /** Hours after the first event. */
  horizonHours?: number;
  /** Sampling resolution in minutes. */
  stepMinutes?: number;
}

export interface SimulationResult {
  samples: Sample[];
  summary: SessionSummary;
  /** True when the evaluation time is before the first logged event. */
  preSession: boolean;
}

export interface PethEstimate {
  ngMl: number;
  band: "abstinence" | "low" | "moderate" | "heavy" | "very-heavy";
  halfLifeDays: number;
  last30dGrams: number;
  note: string;
}

export interface Fib4Result {
  value: number;
  band: "low" | "indeterminate" | "high";
  note: string;
}

export interface LiverPanel {
  fib4: Fib4Result | null;
  astAltRatio: number | null;
  astAltNote: string | null;
  ggt: { value: number; band: "normal" | "elevated" | "high" } | null;
  ferritin: { value: number; band: "normal" | "elevated" | "high" } | null;
  uricAcid: { value: number; band: "normal" | "elevated" | "high" } | null;
  triglycerides: { value: number; band: "normal" | "elevated" | "high" } | null;
}

export type AllostaticBand = "restorative" | "stable" | "strained" | "overloaded";

export interface AllostaticComponent {
  label: string;
  value: number;
  max: number;
  detail: string;
}

export interface AllostaticScore {
  score: number;
  band: AllostaticBand;
  components: AllostaticComponent[];
  heavyDays: number;
  drinkingDays: number;
  averageGrams: number;
  longestStreak: number;
  restDays: number;
  trend: { date: string; score: number }[];
}

export interface ReferenceItem {
  id: string;
  title: string;
  detail: string;
  source: string;
  href?: string;
}
