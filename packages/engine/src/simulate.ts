import {
  ALDH2_CAPACITY,
  BAC_DISTRIBUTION_COEFFICIENT,
  ETHANOL_DENSITY,
  MEDICATION_INFO,
} from "./constants.js";
import type {
  Driver,
  Drink,
  Meal,
  RiskBand,
  Sample,
  Session,
  SessionSummary,
  SimulationInput,
  SimulationResult,
} from "./types.js";
import {
  clamp,
  computeHeadroom,
  effectiveTbw,
  estimateTbw,
  hydrationFactor,
  standardDrinks,
} from "./physiology.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const LN2 = Math.LN2;

interface Scenario {
  tbwScale: number;
  absorptionScale: number;
  vmaxScale: number;
}

const CENTRAL: Scenario = { tbwScale: 1, absorptionScale: 1, vmaxScale: 1 };
const UPPER: Scenario = { tbwScale: 0.9, absorptionScale: 1.2, vmaxScale: 0.9 };
const LOWER: Scenario = { tbwScale: 1.1, absorptionScale: 0.82, vmaxScale: 1.12 };

function ethanolGrams(drink: Drink): number {
  return (drink.volumeMl * Math.max(0, Math.min(100, drink.abv)) * ETHANOL_DENSITY) / 100;
}

function foodLoadAt(meals: Meal[], t: number): number {
  let load = 0;
  for (const meal of meals) {
    const ageH = (t - meal.at) / HOUR;
    if (ageH < 0 || ageH > 14) continue;
    const size = meal.size === "snack" ? 0.35 : meal.size === "meal" ? 0.75 : 1.1;
    const fat = meal.fat === "low" ? 0.25 : meal.fat === "medium" ? 0.6 : 1;
    const protein = meal.protein === "low" ? 0.25 : meal.protein === "medium" ? 0.6 : 1;
    const weight = size * (0.55 + 0.25 * fat + 0.2 * protein);
    load += weight * Math.exp(-ageH / 3.2);
  }
  return clamp(load, 0, 1.25);
}

function hydrationAt(profile: SimulationInput["profile"], session: Session, t: number): number {
  let value = profile.baseline.hydrationPct;
  const start = session.startedAt;
  for (const w of session.waters) {
    if (w.at <= t) value += (w.volumeMl / 1000) * 20;
  }
  for (const d of session.drinks) {
    if (d.at <= t) value -= (d.volumeMl / 1000) * 12;
  }
  const hours = (t - start) / HOUR;
  if (hours > 0) value -= Math.min(10, hours * 0.45);
  return clamp(value, 15, 100);
}

function drinkAbsorptionModifier(drinks: Drink[], t: number): number {
  let total = 0;
  let carb = 0;
  let spirit = 0;
  let dilute = 0;
  for (const d of drinks) {
    const ageH = (t - d.at) / HOUR;
    if (ageH < 0 || ageH > 2.5) continue;
    const g = ethanolGrams(d);
    total += g;
    if (d.carbonated) carb += g;
    if (d.abv >= 20) spirit += g;
    if (d.abv > 0 && d.abv <= 5) dilute += g;
  }
  if (total <= 0) return 1;
  return 1 + 0.18 * (carb / total) - 0.16 * (spirit / total) + 0.05 * (dilute / total);
}

function vmaxFor(profile: SimulationInput["profile"]): number {
  let vmax = 0.17; // g/L/h, population central estimate
  const g = profile.genetics;

  if (g.adh1b === "fast") vmax *= 1.1;
  else if (g.adh1b === "slow") vmax *= 0.94;
  else if (g.adh1b === "intermediate") vmax *= 1.02;

  if (g.aldh2 === "reduced") vmax *= 0.92;
  else if (g.aldh2 === "minimal") vmax *= 0.78;

  if (profile.age > 40) vmax *= 1 - Math.min(0.22, (profile.age - 40) * 0.0035);

  switch (profile.conditions.liver) {
    case "fatty":
      vmax *= 0.85;
      break;
    case "fibrosis":
      vmax *= 0.6;
      break;
    case "cirrhosis":
      vmax *= 0.45;
      break;
    case "none":
      break;
  }

  if (profile.labs?.ggtUaL != null && profile.labs.ggtUaL > 80) vmax *= 0.94;

  return clamp(vmax, 0.06, 0.26);
}

function sleepRemSuppression(bacAtSleep: number, totalG: number, aldh2: string): number {
  const bacEffect = 100 * (1 - Math.exp(-3.6 * Math.max(0, bacAtSleep)));
  const doseEffect = Math.min(15, totalG / 10);
  const genotypeEffect = aldh2 === "active" || aldh2 === "unknown" ? 0 : 8;
  return Math.round(clamp(bacEffect + doseEffect + genotypeEffect, 0, 80));
}

export function riskBandFor(bac: number, acetaldehyde: number, _aldh2: string): RiskBand {
  if (bac >= 0.15 || acetaldehyde >= 45) return "very-high";
  if (bac >= 0.08 || acetaldehyde >= 22) return "high";
  if (bac >= 0.04 || acetaldehyde >= 9) return "moderate";
  if (bac >= 0.01 || acetaldehyde >= 3) return "low";
  return "none";
}

function accumulateDayGrams(drinks: Drink[], t: number): number {
  const d = new Date(t);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let total = 0;
  for (const drink of drinks) {
    if (drink.at >= start && drink.at <= t) total += ethanolGrams(drink);
  }
  return total;
}

interface CoreResult {
  samples: Sample[];
  profile: SimulationInput["profile"];
  session: Session;
}

function runCore(input: SimulationInput, scenario: Scenario): CoreResult {
  const { profile, session } = input;
  const stepMin = clamp(input.stepMinutes ?? 2, 0.5, 10);
  const stepMs = stepMin * MINUTE;
  const horizon = input.horizonHours ?? 14;

  const eventTimes = [
    session.startedAt,
    ...session.drinks.map((d) => d.at),
    ...session.meals.map((m) => m.at),
    ...session.waters.map((w) => w.at),
  ].filter(Number.isFinite);

  const first = Math.min(...eventTimes);
  const start = Math.floor((first - 10 * MINUTE) / stepMs) * stepMs;
  const end = start + horizon * HOUR;

  const drinks = [...session.drinks].sort((a, b) => a.at - b.at);
  const meals = [...session.meals].sort((a, b) => a.at - b.at);
  const waters = [...session.waters].sort((a, b) => a.at - b.at);

  const tbwBase = estimateTbw(profile).litres;
  const vmax = vmaxFor(profile) * scenario.vmaxScale;
  const km = 0.06;
  const aldhCapacity = ALDH2_CAPACITY[profile.genetics.aldh2];
  const kAch = 1.8 * aldhCapacity;
  const pAch = 40 * (profile.genetics.adh1b === "fast" ? 1.15 : profile.genetics.adh1b === "slow" ? 0.92 : 1);

  let stomach = 0;
  let gut = 0;
  let body = 0;
  let ach = 0;

  const samples: Sample[] = [];
  let di = 0;
  let mi = 0;
  let wi = 0;

  let calories = 0;

  for (let t = start; t <= end + 1; t += stepMs) {
    while (di < drinks.length && drinks[di].at <= t) {
      const g = ethanolGrams(drinks[di]);
      stomach += g;
      calories += g * 7;
      di += 1;
    }
    while (mi < meals.length && meals[mi].at <= t) mi += 1;
    while (wi < waters.length && waters[wi].at <= t) wi += 1;

    const foodLoad = foodLoadAt(meals, t);
    const hydration = hydrationAt(profile, session, t);
    const tbw = tbwBase * scenario.tbwScale * hydrationFactor(hydration);
    const volumeScale = tbw * BAC_DISTRIBUTION_COEFFICIENT;

    const absorptionMod = drinkAbsorptionModifier(drinks, t) * scenario.absorptionScale;
    const gastricHalfLife = 16 + 76 * foodLoad;
    const kGe = (LN2 / gastricHalfLife) * absorptionMod;
    const ka = (0.085 - 0.035 * foodLoad) * absorptionMod;

    let firstPass = (0.05 + 0.14 * foodLoad) *
      (profile.genetics.adh1b === "fast" ? 1.35 : profile.genetics.adh1b === "slow" ? 0.85 : 1) *
      (profile.genetics.adh1c === "fast" ? 1.08 : profile.genetics.adh1c === "slow" ? 0.88 : 1);
    firstPass = clamp(firstPass, 0, 0.3);

    const stomachBefore = stomach;
    const emptied = stomachBefore * (1 - Math.exp((-kGe * stepMs) / MINUTE));
    stomach -= emptied;
    const systemic = emptied * (1 - firstPass);
    gut += systemic;
    const absorbed = gut * (1 - Math.exp((-ka * stepMs) / MINUTE));
    gut -= absorbed;
    body += absorbed;

    const bacForRate = body / Math.max(1, volumeScale);
    const cGramsPerL = bacForRate * 10;
    const mm = (vmax * cGramsPerL) / (km + cGramsPerL);
    const elim = Math.min(body, (mm * (volumeScale / BAC_DISTRIBUTION_COEFFICIENT) * stepMin) / 60);
    body = Math.max(0, body - elim);

    // Acetaldehyde is produced in proportion to hepatic oxidation and cleared
    // by ALDH2. Deficient alleles turn a small flux into a large pool. The
    // exact exponential update keeps the stiff clearance term stable at coarse
    // time steps.
    const oxidationGPerMin = elim / stepMin;
    const decay = Math.exp(-kAch * stepMin);
    ach = Math.max(0, ach * decay + (pAch * oxidationGPerMin / kAch) * (1 - decay));

    const bac = body / Math.max(1, volumeScale);
    const achIndex = ach / 2;
    const heartRateDelta = clamp(
      2 + 2.2 * achIndex + 16 * bac + (profile.genetics.aldh2 === "reduced" ? 3 : profile.genetics.aldh2 === "minimal" ? 6 : 0) + profile.baseline.stress * 0.25,
      0,
      32,
    );
    const hrvSuppression = clamp(100 * (1 - Math.exp(-0.06 * achIndex - 2.6 * bac)), 0, 85);
    const sleepPressure = clamp(100 * (1 - Math.exp(-2.8 * bac)) + (profile.genetics.aldh2 !== "active" ? 6 : 0), 0, 100);
    const impairment = clamp(100 * (1 - Math.exp(-4.6 * bac)), 0, 100);

    const fasting = foodLoad < 0.12;
    const oxidationIntensity = clamp(oxidationGPerMin * 60 / 6, 0, 1);
    const medRisk =
      profile.medications.includes("insulin") || profile.medications.includes("sulfonylurea")
        ? 0.9
        : profile.conditions.diabetes !== "none"
          ? 0.45
          : 0;
    const glucose = latestGlucose(session, t);
    const lowGlucose = glucose != null && glucose < 70 ? 1 : 0;
    const hypoglycemiaRisk = clamp(
      100 * clamp(0.55 * oxidationIntensity * (fasting ? 1 : 0.42) + 0.22 * medRisk + 0.14 * clamp((8 - profile.baseline.sleepHours) / 4, 0, 1) + 0.28 * lowGlucose, 0, 1),
      0,
      100,
    );

    const dayGrams = accumulateDayGrams(drinks, t);
    const headroom = computeHeadroom(profile, dayGrams, t);

    const absorptionRate = (absorbed / stepMs) * MINUTE;
    const oxidationRate = (elim / stepMs) * MINUTE;

    samples.push({
      t,
      bac,
      stomachG: stomach,
      gutG: gut,
      bodyG: body,
      acetaldehydeUmolL: ach,
      oxidationGPerH: oxidationRate * 60,
      absorptionGPerH: absorptionRate * 60,
      hydration,
      heartRateDelta,
      hrvSuppressionPct: hrvSuppression,
      hypoglycemiaRisk,
      sleepPressure,
      impairment,
      headroomG: headroom.remainingG,
      calories,
    });
  }

  // Keep the summary dose out of band on the returned samples.
  return { samples, profile, session };
}

function latestGlucose(session: Session, t: number): number | null {
  let best: number | null = null;
  let bestAt = -Infinity;
  for (const s of session.sensors) {
    if (s.glucoseMgDl != null && s.at <= t && s.at > bestAt) {
      best = s.glucoseMgDl;
      bestAt = s.at;
    }
  }
  return best;
}

export function sampleAt(samples: Sample[], t: number): Sample | null {
  if (!samples.length) return null;
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];
  let lo = 0;
  let hi = samples.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t === t) return samples[mid];
    if (samples[mid].t < t) lo = mid + 1;
    else hi = mid - 1;
  }
  const a = samples[Math.max(0, hi)];
  const b = samples[Math.min(samples.length - 1, lo)];
  if (!a || !b || a.t === b.t) return a ?? b;
  const f = (t - a.t) / (b.t - a.t);
  const lerp = (x: number, y: number) => x + (y - x) * f;
  return {
    ...a,
    t,
    bac: lerp(a.bac, b.bac),
    acetaldehydeUmolL: lerp(a.acetaldehydeUmolL, b.acetaldehydeUmolL),
    heartRateDelta: lerp(a.heartRateDelta, b.heartRateDelta),
    hrvSuppressionPct: lerp(a.hrvSuppressionPct, b.hrvSuppressionPct),
    impairment: lerp(a.impairment, b.impairment),
    hypoglycemiaRisk: lerp(a.hypoglycemiaRisk, b.hypoglycemiaRisk),
    sleepPressure: lerp(a.sleepPressure, b.sleepPressure),
    headroomG: lerp(a.headroomG, b.headroomG),
  };
}

function firstBelow(samples: Sample[], from: number, threshold: number): number | null {
  for (const s of samples) {
    if (s.t >= from && s.bac < threshold) return s.t;
  }
  return null;
}

function buildDrivers(
  profile: SimulationInput["profile"],
  session: Session,
  at: number,
  headroom: ReturnType<typeof computeHeadroom>,
): Driver[] {
  const drivers: Driver[] = [...headroom.drivers];

  const recentMeal = session.meals
    .filter((m) => m.at <= at && at - m.at < 8 * HOUR)
    .sort((a, b) => b.at - a.at)[0];

  if (recentMeal) {
    const h = (at - recentMeal.at) / HOUR;
    const heavy = recentMeal.fat === "high" || recentMeal.protein === "high" || recentMeal.size === "large";
    drivers.push({
      label: "Fed state",
      effect: heavy
        ? `Meal ${h.toFixed(1)} h ago slows absorption and lowers the peak`
        : `Light meal ${h.toFixed(1)} h ago`,
      multiplier: 1,
      tone: "protective",
    });
  } else {
    drivers.push({
      label: "Fasted",
      effect: "Faster gastric emptying and a sharper BAC rise",
      multiplier: 1,
      tone: "risk",
    });
  }

  const hydration = hydrationAt(profile, session, at);
  drivers.push({
    label: "Hydration",
    effect: `${hydration.toFixed(0)}% · ${hydration < 45 ? "low plasma volume concentrates ethanol" : "within a normal range"}`,
    multiplier: 1,
    tone: hydration < 45 ? "risk" : "neutral",
  });

  if (profile.baseline.sleepHours < 6.5) {
    drivers.push({
      label: "Sleep debt",
      effect: `${profile.baseline.sleepHours.toFixed(1)} h typical sleep raises next-day strain`,
      multiplier: 1,
      tone: "risk",
    });
  }

  const flags = new Set<string>();
  const existing = new Set(drivers.map((d) => d.label));
  for (const med of profile.medications) {
    const info = MEDICATION_INFO[med];
    if (!info || existing.has(info.label)) continue;
    for (const flag of info.flags) {
      if (!flags.has(flag)) {
        flags.add(flag);
        drivers.push({ label: info.label, effect: flag, multiplier: info.ceilingMultiplier, tone: "risk" });
      }
    }
  }

  return drivers.slice(0, 8);
}

export function simulate(input: SimulationInput): SimulationResult {
  const central = runCore(input, CENTRAL);
  const upper = runCore(input, UPPER);
  const lower = runCore(input, LOWER);
  const samples = central.samples;

  for (let i = 0; i < samples.length; i++) {
    const hi = upper.samples[i]?.bac ?? samples[i].bac;
    const lo = lower.samples[i]?.bac ?? samples[i].bac;
    samples[i].bacLow = Math.min(lo, samples[i].bac);
    samples[i].bacHigh = Math.max(hi, samples[i].bac);
  }

  const { profile, session, at } = input;
  const current = sampleAt(samples, at) ?? samples[0];

  let peakBac = 0;
  let peakBacAt = at;
  let achPeak = 0;
  let achPeakAt = at;
  for (const s of samples) {
    if (s.t < session.startedAt) continue;
    if (s.bac > peakBac) {
      peakBac = s.bac;
      peakBacAt = s.t;
    }
    if (s.acetaldehydeUmolL > achPeak) {
      achPeak = s.acetaldehydeUmolL;
      achPeakAt = s.t;
    }
  }

  const lastDrinkAt = session.drinks.length
    ? Math.max(...session.drinks.map((d) => d.at))
    : session.startedAt;

  const impairmentClearedAt = peakBac > 0.001 ? firstBelow(samples, at, 0.02) : null;
  const clearanceAt = peakBac > 0.001 ? firstBelow(samples, at, 0.001) : null;

  const sleepTime = lastDrinkAt + 2 * HOUR;
  const sleepSample = sampleAt(samples, sleepTime);
  const bacAtSleep = sleepSample?.bac ?? 0;
  const totalEthanolG = session.drinks.reduce((s, d) => s + ethanolGrams(d), 0);
  const remSuppression = sleepRemSuppression(bacAtSleep, totalEthanolG, profile.genetics.aldh2);

  const futureSamples = samples.filter((s) => s.t >= at && s.t <= at + 12 * HOUR);
  const predictedHrvDrop = futureSamples.length
    ? Math.max(...futureSamples.map((s) => s.hrvSuppressionPct))
    : current.hrvSuppressionPct;
  const hypoglycemiaPeak = futureSamples.length
    ? Math.max(...futureSamples.map((s) => s.hypoglycemiaRisk))
    : current.hypoglycemiaRisk;
  const cardiovascularPeak = futureSamples.length
    ? Math.max(...futureSamples.map((s) => s.heartRateDelta))
    : current.heartRateDelta;

  const dayGrams = accumulateDayGrams(session.drinks, at);
  const headroom = computeHeadroom(profile, dayGrams, at);

  const upperSample = sampleAt(upper.samples, at) ?? upper.samples[0];
  const lowerSample = sampleAt(lower.samples, at) ?? lower.samples[0];
  const bacLow = Math.min(lowerSample?.bac ?? current.bac, current.bac);
  const bacHigh = Math.max(upperSample?.bac ?? current.bac, current.bac);

  const drinks = standardDrinks(totalEthanolG);

  const summary: SessionSummary = {
    at,
    totalEthanolG,
    standardDrinks: drinks.us,
    peakBac,
    peakBacAt,
    currentBac: current.bac,
    currentAcetaldehydeUmolL: current.acetaldehydeUmolL,
    acetaldehydePeak: achPeak,
    peakAcetaldehydeAt: achPeakAt,
    impairmentClearedAt,
    clearanceAt,
    minutesToImpairmentClear: impairmentClearedAt != null ? Math.max(0, (impairmentClearedAt - at) / MINUTE) : null,
    minutesToClearance: clearanceAt != null ? Math.max(0, (clearanceAt - at) / MINUTE) : null,
    headroom,
    riskBand: riskBandFor(current.bac, current.acetaldehydeUmolL, profile.genetics.aldh2),
    estimatedRemSuppressionPct: remSuppression,
    predictedSleepHrDelta: -Math.round(remSuppression * 0.012 * 10) / 10,
    predictedHrvDropPct: Math.round(predictedHrvDrop),
    hypoglycemiaPeak: Math.round(hypoglycemiaPeak),
    cardiovascularPeakHrDelta: Math.round(cardiovascularPeak),
    confidence: {
      bacLow,
      bacHigh,
      tbwSdL: estimateTbw(profile).standardDeviation,
    },
    drivers: buildDrivers(profile, session, at, headroom),
  };

  const sorted = [...session.drinks].sort((a, b) => a.at - b.at);
  return {
    samples,
    summary,
    preSession: !sorted.length || at < sorted[0].at,
  };
}

/** Convert BAC in g/dL to the common mmol/L and breath-equivalent units. */
export function bacUnits(gDl: number): { gDl: number; mmolL: number; mgLBreath: number; permille: number } {
  return {
    gDl,
    mmolL: gDl * 217.1,
    mgLBreath: gDl * 2.1,
    permille: gDl * 10,
  };
}

/** Convenience helper for UI copy: "2 h 14 min". */
export function formatDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "beyond 24 h";
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}
