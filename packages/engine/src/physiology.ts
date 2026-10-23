import {
  ALDH2_CAPACITY,
  MEDICATION_INFO,
} from "./constants.js";
import type {
  AllostaticScore,
  DailyLog,
  Driver,
  Fib4Result,
  Headroom,
  LabPanel,
  LiverPanel,
  PethEstimate,
  Profile,
  ReferenceItem,
} from "./types.js";
import { REFERENCES } from "./constants.js";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface TbwEstimate {
  litres: number;
  method: "body-composition" | "watson";
  standardDeviation: number;
  fatMassKg: number | null;
  leanMassKg: number | null;
}

/**
 * Total body water, the volume ethanol actually distributes into.
 *
 * When body composition is known we use fat-free mass hydration (0.73 L/kg)
 * plus the small water fraction of adipose tissue (0.15 L/kg). Otherwise we
 * fall back to the Watson anthropometric equation.
 */
export function estimateTbw(profile: Profile): TbwEstimate {
  const { weightKg, heightCm, age, sex, bodyFatPct } = profile;

  if (bodyFatPct != null && Number.isFinite(bodyFatPct)) {
    const bf = clamp(bodyFatPct, 3, 62);
    const fatMass = (weightKg * bf) / 100;
    const leanMass = weightKg - fatMass;
    const litres = leanMass * 0.73 + fatMass * 0.15;
    return {
      litres,
      method: "body-composition",
      standardDeviation: litres * 0.07,
      fatMassKg: fatMass,
      leanMassKg: leanMass,
    };
  }

  const heightM = heightCm / 100;
  const watson =
    sex === "male"
      ? 2.447 - 0.09516 * age + 0.1074 * heightCm + 0.3362 * weightKg
      : -2.097 + 0.1069 * heightCm + 0.2466 * weightKg;
  const litres = clamp(watson, 18, 70);
  return {
    litres,
    method: "watson",
    standardDeviation: litres * 0.09,
    fatMassKg: null,
    leanMassKg: null,
  };
}

/** Hydration shifts plasma volume and therefore the apparent volume of distribution. */
export function hydrationFactor(hydrationPct: number): number {
  return 0.95 + clamp(hydrationPct, 0, 100) * 0.0007;
}

export function effectiveTbw(profile: Profile, hydrationPct: number): number {
  return estimateTbw(profile).litres * hydrationFactor(hydrationPct);
}

/** Standard drinks: US 14 g and WHO 10 g. */
export function standardDrinks(grams: number): { us: number; who: number } {
  return { us: grams / 14, who: grams / 10 };
}

/**
 * Personalised low-risk reference for a single day.
 *
 * This is NOT a safe allowance. The only zero-risk dose is zero. It is a
 * harm-reduction anchor: the point above which the modelled acetaldehyde,
 * hepatic and sleep load stops looking trivial for this specific person.
 */
export function computeHeadroom(
  profile: Profile,
  consumedG: number,
  at: number,
): Headroom {
  const referenceG = profile.sex === "male" ? 20 : 10;
  const drivers: Driver[] = [];
  let multiplier = 1;

  const push = (
    label: string,
    effect: string,
    m: number,
    tone: Driver["tone"],
  ) => {
    if (m !== 1) {
      multiplier *= m;
      drivers.push({ label, effect, multiplier: m, tone });
    }
  };

  const tbw = estimateTbw(profile);
  const referenceTbw = profile.sex === "male" ? 40 : 33;
  const waterScale = clamp(Math.pow(tbw.litres / referenceTbw, 0.5), 0.85, 1.15);
  push("Body water", `${tbw.litres.toFixed(1)} L distribution volume`, waterScale, waterScale > 1 ? "protective" : "risk");

  if (profile.age >= 65) {
    push("Age", "Reduced hepatic perfusion and body water", 0.85, "risk");
  }

  if (profile.genetics.aldh2 === "reduced") {
    push("ALDH2 *1/*2", "Acetaldehyde clearance reduced ~70%", 0.5, "risk");
  } else if (profile.genetics.aldh2 === "minimal") {
    push("ALDH2 *2/*2", "Acetaldehyde clearance reduced ~94%", 0.15, "risk");
  }
  if (profile.genetics.adh1b === "fast") {
    push("ADH1B *2/*2", "Faster ethanol-to-acetaldehyde conversion", 0.92, "risk");
  }

  if (profile.conditions.pregnancy) {
    multiplier = 0;
    drivers.push({ label: "Pregnancy", effect: "No established safe dose", multiplier: 0, tone: "risk" });
  }

  switch (profile.conditions.liver) {
    case "fatty":
      push("Hepatic steatosis", "Reduced functional reserve", 0.6, "risk");
      break;
    case "fibrosis":
      push("Liver fibrosis", "Impaired clearance; clinical advice needed", 0.25, "risk");
      break;
    case "cirrhosis":
      multiplier = 0;
      drivers.push({ label: "Cirrhosis", effect: "Any alcohol accelerates decompensation", multiplier: 0, tone: "risk" });
      break;
    case "none":
      break;
  }

  if (profile.conditions.diabetes !== "none") {
    push("Diabetes", "Hypoglycaemia risk during and after drinking", 0.8, "risk");
  }

  const seen = new Set<string>();
  for (const med of profile.medications) {
    const info = MEDICATION_INFO[med];
    if (!info || seen.has(info.label)) continue;
    seen.add(info.label);
    push(info.label, info.class, info.ceilingMultiplier, "risk");
  }

  const labs = profile.labs;
  if (labs) {
    if (labs.pethNgMl != null && labs.pethNgMl >= 100) {
      push("PEth", `${labs.pethNgMl.toFixed(0)} ng/mL indicates sustained exposure`, 0.7, "risk");
    }
    if (labs.ggtUaL != null && labs.ggtUaL > 80) {
      push("GGT", `${labs.ggtUaL.toFixed(0)} U/L suggests enzyme induction`, 0.8, "risk");
    }
    if (labs.astUaL != null && labs.altUaL != null && labs.plateletsKUl != null) {
      const fib4 = computeFib4(profile.age, labs.astUaL, labs.altUaL, labs.plateletsKUl);
      if (fib4.band === "high") {
        push("FIB-4", `${fib4.value.toFixed(2)} · possible advanced fibrosis`, 0.4, "risk");
      }
    }
  }

  const raw = referenceG * multiplier;
  const ceilingG = multiplier === 0 ? 0 : Math.max(2, Math.round(raw));
  const consumed = Math.max(0, consumedG);
  const remainingG = Math.max(0, ceilingG - consumed);
  const usedPct = ceilingG > 0 ? clamp((consumed / ceilingG) * 100, 0, 100) : 100;

  const d = new Date(at);
  const resetsAt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();

  drivers.sort((a, b) => a.multiplier - b.multiplier);
  return {
    ceilingG,
    referenceG,
    consumedG: consumed,
    remainingG,
    usedPct,
    resetsAt,
    drivers,
  };
}

export function computeFib4(
  age: number,
  ast: number,
  alt: number,
  platelets: number,
): Fib4Result {
  const value = (age * ast) / (platelets * Math.sqrt(alt));
  const highCut = age > 65 ? 2.0 : 2.67;
  const band = value < 1.3 ? "low" : value <= highCut ? "indeterminate" : "high";
  const note =
    band === "low"
      ? "Low probability of advanced fibrosis. Recheck if liver markers rise."
      : band === "indeterminate"
        ? "Indeterminate range. Repeat with a fasting panel and discuss with a clinician."
        : "High probability of advanced fibrosis. Stop drinking and seek clinical assessment.";
  return { value, band, note };
}

export function interpretLabs(profile: Profile): LiverPanel {
  const labs = profile.labs;
  if (!labs) {
    return { fib4: null, astAltRatio: null, astAltNote: null, ggt: null, ferritin: null, uricAcid: null, triglycerides: null };
  }

  const fib4 =
    labs.astUaL != null && labs.altUaL != null && labs.plateletsKUl != null
      ? computeFib4(profile.age, labs.astUaL, labs.altUaL, labs.plateletsKUl)
      : null;

  const astAltRatio =
    labs.astUaL != null && labs.altUaL != null && labs.altUaL > 0
      ? labs.astUaL / labs.altUaL
      : null;

  let astAltNote: string | null = null;
  if (astAltRatio != null) {
    if (astAltRatio >= 2) {
      astAltNote = "Ratio ≥ 2 is classically associated with alcohol-related liver injury.";
    } else if (astAltRatio > 1) {
      astAltNote = "Ratio above 1 can accompany alcohol-related injury but is non-specific.";
    } else {
      astAltNote = "Ratio below 1 is non-specific and common in fatty liver disease.";
    }
  }

  const band = (
    value: number | null | undefined,
    normal: number,
    high: number,
  ): "normal" | "elevated" | "high" | null => {
    if (value == null) return null;
    if (value <= normal) return "normal";
    if (value <= high) return "elevated";
    return "high";
  };

  const ggtBand = band(labs.ggtUaL, profile.sex === "male" ? 60 : 42, 120);
  const ferritinBand = band(labs.ferritinNgMl, profile.sex === "male" ? 300 : 200, 600);
  const uricBand = band(labs.uricAcidMgDl, profile.sex === "male" ? 7 : 6, 9);
  const trigBand = band(labs.triglyceridesMgDl, 150, 500);

  return {
    fib4,
    astAltRatio,
    astAltNote,
    ggt: ggtBand && labs.ggtUaL != null ? { value: labs.ggtUaL, band: ggtBand } : null,
    ferritin: ferritinBand && labs.ferritinNgMl != null ? { value: labs.ferritinNgMl, band: ferritinBand } : null,
    uricAcid: uricBand && labs.uricAcidMgDl != null ? { value: labs.uricAcidMgDl, band: uricBand } : null,
    triglycerides: trigBand && labs.triglyceridesMgDl != null ? { value: labs.triglyceridesMgDl, band: trigBand } : null,
  };
}

export const PETH_HALF_LIFE_DAYS = 4.5;

/**
 * Forward estimate of PEth from a daily drinking record.
 *
 * Calibration: ~30 g/day sustained produces roughly 90-120 ng/mL, consistent
 * with the moderate-to-heavy range reported in the literature. This is an
 * educational estimate, not a substitute for a lab result.
 */
export function estimatePeth(history: DailyLog[], now: number): PethEstimate {
  const byDate = new Map<string, DailyLog>();
  for (const day of history) byDate.set(day.date, day);

  const nowDate = new Date(now);
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  let weighted = 0;
  let last30 = 0;

  for (const day of byDate.values()) {
    const [y, m, d] = day.date.split("-").map(Number);
    const t = new Date(y, m - 1, d).getTime();
    const daysAgo = (startOfToday - t) / 86_400_000;
    if (!Number.isFinite(daysAgo) || daysAgo < 0) continue;
    if (daysAgo <= 30) last30 += day.grams;
    weighted += day.grams * Math.pow(0.5, daysAgo / PETH_HALF_LIFE_DAYS);
  }

  const ngMl = weighted * 0.45;
  const band =
    ngMl < 8
      ? "abstinence"
      : ngMl < 20
        ? "low"
        : ngMl < 100
          ? "moderate"
          : ngMl < 300
            ? "heavy"
            : "very-heavy";

  return {
    ngMl,
    band,
    halfLifeDays: PETH_HALF_LIFE_DAYS,
    last30dGrams: last30,
    note:
      "PEth is a cumulative exposure marker, not a measure of intoxication. A lab result supersedes this estimate.",
  };
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Composite 0-100 allostatic load. It deliberately mixes exposure, liver
 * markers, recovery and sleep so that a single heavy night cannot hide behind
 * a low weekly average, and a clean week cannot erase a rising GGT.
 */
export function computeAllostatic(
  profile: Profile,
  history: DailyLog[],
  at: number,
): AllostaticScore {
  const windowDays = 90;
  const end = new Date(at);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (windowDays - 1));
  const byDate = new Map(history.map((d) => [d.date, d]));

  const days: DailyLog[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(d);
    days.push(byDate.get(key) ?? { date: key, grams: 0, standardDrinks: 0 });
  }

  const ceiling = computeHeadroom(profile, 0, at).ceilingG;
  const avgGrams = days.reduce((s, d) => s + d.grams, 0) / windowDays;
  const heavyDays = days.filter((d) => d.grams > ceiling).length;
  const drinkingDays = days.filter((d) => d.grams > 0).length;
  const restDays = windowDays - drinkingDays;

  let longestStreak = 0;
  let streak = 0;
  for (const d of days) {
    if (d.grams > 0) {
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  const peth = estimatePeth(history, at);
  const labs = interpretLabs(profile);

  const exposurePoints = clamp((avgGrams / Math.max(1, ceiling)) * 22, 0, 40);
  const heavyPoints = clamp((heavyDays / windowDays) * 120, 0, 20);

  let pethPoints = 0;
  if (peth.ngMl >= 20) pethPoints = clamp(((peth.ngMl - 20) / 180) * 20, 0, 20);

  let liverPoints = 0;
  const liverNotes: string[] = [];
  if (labs.fib4) {
    if (labs.fib4.band === "high") {
      liverPoints += 10;
      liverNotes.push("FIB-4 high");
    } else if (labs.fib4.band === "indeterminate") {
      liverPoints += 4;
      liverNotes.push("FIB-4 indeterminate");
    }
  }
  if (labs.ggt?.band === "high") {
    liverPoints += 4;
    liverNotes.push("GGT high");
  } else if (labs.ggt?.band === "elevated") {
    liverPoints += 2;
    liverNotes.push("GGT elevated");
  }
  liverPoints = clamp(liverPoints, 0, 10);

  const recoveryPoints = clamp(longestStreak * 2, 0, 10);

  const sleepDays = days.filter((d) => d.sleepHours != null);
  const avgSleep = sleepDays.length
    ? sleepDays.reduce((s, d) => s + (d.sleepHours ?? 0), 0) / sleepDays.length
    : profile.baseline.sleepHours;
  const sleepPoints = clamp(((7.5 - avgSleep) / 3) * 8, 0, 8);

  const components = [
    { label: "Exposure", value: exposurePoints, max: 40, detail: `${avgGrams.toFixed(1)} g/day average vs ${ceiling} g reference` },
    { label: "Heavy days", value: heavyPoints, max: 20, detail: `${heavyDays} days above the personal reference` },
    { label: "PEth", value: pethPoints, max: 20, detail: `Estimated ${peth.ngMl.toFixed(0)} ng/mL` },
    { label: "Hepatic", value: liverPoints, max: 10, detail: liverNotes.length ? liverNotes.join(" · ") : "No lab flags" },
    { label: "Recovery", value: recoveryPoints, max: 10, detail: `Longest consecutive drinking run: ${longestStreak} days` },
    { label: "Sleep debt", value: sleepPoints, max: 8, detail: `${avgSleep.toFixed(1)} h average` },
  ];

  const score = Math.round(clamp(components.reduce((s, c) => s + c.value, 0), 0, 100));
  const band =
    score < 20 ? "restorative" : score < 40 ? "stable" : score < 65 ? "strained" : "overloaded";

  const trend: { date: string; score: number }[] = [];
  for (let i = Math.max(0, windowDays - 30); i < windowDays; i++) {
    const through = days.slice(0, i + 1).slice(-14);
    const avg = through.reduce((s, d) => s + d.grams, 0) / Math.max(1, through.length);
    const heavy = through.filter((d) => d.grams > ceiling).length;
    const localScore = Math.round(
      clamp(
        (avg / Math.max(1, ceiling)) * 22 +
          (heavy / Math.max(1, through.length)) * 20 +
          pethPoints +
          liverPoints +
          Math.min(10, longestStreak * 2) +
          sleepPoints,
        0,
        100,
      ),
    );
    trend.push({ date: days[i].date, score: localScore });
  }

  return {
    score,
    band,
    components,
    heavyDays,
    drinkingDays,
    averageGrams: avgGrams,
    longestStreak,
    restDays,
    trend,
  };
}

export function references(): ReferenceItem[] {
  return REFERENCES;
}

export { clamp };
