import type { DailyLog, Drink, Profile, Session } from "./types.js";
import { ETHANOL_DENSITY } from "./constants.js";

const HOUR = 3_600_000;
const MINUTE = 60_000;

export function drinkEthanolGrams(drink: Pick<Drink, "volumeMl" | "abv">): number {
  return (drink.volumeMl * drink.abv * ETHANOL_DENSITY) / 100;
}

export function makeDemoProfile(): Profile {
  return {
    name: "Sam Rivera",
    age: 33,
    sex: "male",
    heightCm: 181,
    weightKg: 78,
    bodyFatPct: 17,
    genetics: { adh1b: "intermediate", adh1c: "intermediate", aldh2: "reduced" },
    conditions: { liver: "none", diabetes: "none", hypertension: false, pregnancy: false },
    medications: [],
    baseline: {
      restingHr: 58,
      hrvMs: 52,
      sleepHours: 6.8,
      hydrationPct: 55,
      stress: 4,
      weeklyExerciseMinutes: 180,
    },
    labs: {
      collectedAt: new Date().toISOString().slice(0, 10),
      pethNgMl: 34,
      ggtUaL: 52,
      astUaL: 28,
      altUaL: 34,
      plateletsKUl: 245,
      ferritinNgMl: 180,
      triglyceridesMgDl: 132,
      uricAcidMgDl: 6.1,
      hba1cPct: 5.3,
    },
  };
}

export function makeDemoSession(now: number): Session {
  return {
    startedAt: now - 95 * MINUTE,
    drinks: [
      { id: "demo-1", at: now - 95 * MINUTE, volumeMl: 330, abv: 5, label: "Lager, 330 ml", carbonated: true },
      { id: "demo-2", at: now - 50 * MINUTE, volumeMl: 175, abv: 13.5, label: "Red wine, 175 ml" },
      { id: "demo-3", at: now - 12 * MINUTE, volumeMl: 330, abv: 5, label: "Lager, 330 ml", carbonated: true },
    ],
    meals: [
      { id: "demo-m1", at: now - 140 * MINUTE, size: "large", fat: "high", protein: "medium" },
    ],
    waters: [{ id: "demo-w1", at: now - 8 * MINUTE, volumeMl: 500 }],
    sensors: [],
    readings: [],
  };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A deterministic example record, explicitly labelled in the UI. It exists so
 * the chronic-load views can be evaluated without inventing data on behalf of
 * a real user.
 */
export function makeDemoHistory(now: number, days = 90): DailyLog[] {
  const rand = mulberry32(20261023);
  const out: DailyLog[] = [];
  const end = new Date(now);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 5 || dow === 6;
    const roll = rand();
    let grams = 0;
    if (weekend && roll < 0.82) grams = 22 + rand() * 46;
    else if (!weekend && roll < 0.26) grams = 10 + rand() * 20;
    if (roll > 0.94) grams += 30;
    const drinking = grams > 0;
    out.push({
      date: key(d),
      grams: Math.round(grams),
      standardDrinks: Math.round((grams / 14) * 10) / 10,
      sleepHours: Math.round((6.1 + rand() * 1.8 - (drinking ? 0.5 : 0)) * 10) / 10,
      restingHr: Math.round(56 + rand() * 6 + (drinking ? 4 : 0)),
      hrvMs: Math.round(48 + rand() * 12 - (drinking ? 9 : 0)),
      note: drinking && grams > 50 ? "Late night, poor sleep" : undefined,
    });
  }
  return out;
}

export function demoEvents(now: number) {
  return [
    { id: "d1", at: now - 95 * MINUTE, label: "Lager" },
    { id: "d2", at: now - 50 * MINUTE, label: "Wine" },
    { id: "d3", at: now - 12 * MINUTE, label: "Lager" },
    { id: "m1", at: now - 140 * MINUTE, label: "Dinner" },
    { id: "h1", at: now + 7 * HOUR, label: "Rise" },
  ];
}
