import { describe, expect, it } from "vitest";
import {
  computeAllostatic,
  computeFib4,
  computeHeadroom,
  drinkEthanolGrams,
  estimatePeth,
  estimateTbw,
  makeDemoHistory,
  makeDemoProfile,
  makeDemoSession,
  simulate,
} from "../src/index.js";
import type { Drink, Profile, Session } from "../src/index.js";

const BASE = new Date(2026, 9, 23, 20, 0, 0).getTime();
const HOUR = 3_600_000;

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "Test",
    age: 30,
    sex: "male",
    heightCm: 178,
    weightKg: 75,
    bodyFatPct: 18,
    genetics: { adh1b: "intermediate", adh1c: "intermediate", aldh2: "active" },
    conditions: { liver: "none", diabetes: "none", hypertension: false, pregnancy: false },
    medications: [],
    baseline: {
      restingHr: 58,
      hrvMs: 55,
      sleepHours: 7.5,
      hydrationPct: 60,
      stress: 3,
      weeklyExerciseMinutes: 150,
    },
    labs: null,
    ...overrides,
  };
}

function session(drinks: Drink[], meals: Session["meals"] = []): Session {
  return { startedAt: BASE, drinks, meals, waters: [], sensors: [], readings: [] };
}

function beer(grams: number, at = BASE): Drink {
  return {
    id: `d-${at}-${grams}`,
    at,
    volumeMl: grams / 0.789 / 0.05,
    abv: 5,
    label: "Beer",
    carbonated: false,
  };
}

describe("total body water", () => {
  it("uses fat-free mass when body composition exists", () => {
    const t = estimateTbw(profile({ weightKg: 70, bodyFatPct: 20 }));
    // 56 kg FFM * 0.73 + 14 kg fat * 0.15 = 42.98 L
    expect(t.method).toBe("body-composition");
    expect(t.litres).toBeCloseTo(42.98, 1);
  });

  it("falls back to Watson when body fat is unknown", () => {
    const t = estimateTbw(profile({ bodyFatPct: null }));
    expect(t.method).toBe("watson");
    expect(t.litres).toBeGreaterThan(35);
    expect(t.litres).toBeLessThan(50);
  });

  it("gives women a smaller distribution volume at the same weight", () => {
    const male = estimateTbw(profile({ sex: "male", bodyFatPct: 20 }));
    const female = estimateTbw(profile({ sex: "female", bodyFatPct: 28 }));
    expect(female.litres).toBeLessThan(male.litres);
  });
});

describe("acute pharmacokinetics", () => {
  it("produces a plausible peak and clears over several hours", () => {
    const result = simulate({
      profile: profile(),
      session: session([beer(30)]),
      at: BASE + HOUR,
      horizonHours: 16,
      stepMinutes: 1,
    });

    expect(result.summary.peakBac).toBeGreaterThan(0.03);
    expect(result.summary.peakBac).toBeLessThan(0.1);
    expect(result.summary.clearanceAt).not.toBeNull();
    expect(result.summary.minutesToClearance).toBeGreaterThan(120);
    expect(result.samples[result.samples.length - 1].bac).toBeLessThan(0.005);
  });

  it("lowers and delays the peak when food is present", () => {
    const fasted = simulate({
      profile: profile(),
      session: session([beer(30)]),
      at: BASE + HOUR,
    });
    const fed = simulate({
      profile: profile(),
      session: session([beer(30)], [{ id: "m", at: BASE - 30 * 60_000, size: "large", fat: "high", protein: "high" }]),
      at: BASE + HOUR,
    });

    expect(fed.summary.peakBac).toBeLessThan(fasted.summary.peakBac);
    expect(fed.summary.peakBacAt).toBeGreaterThan(fasted.summary.peakBacAt);
  });

  it("raises acetaldehyde several-fold with ALDH2 deficiency", () => {
    const normal = simulate({
      profile: profile(),
      session: session([beer(40)]),
      at: BASE + HOUR,
    });
    const deficient = simulate({
      profile: profile({ genetics: { adh1b: "intermediate", adh1c: "intermediate", aldh2: "reduced" } }),
      session: session([beer(40)]),
      at: BASE + HOUR,
    });

    expect(deficient.summary.acetaldehydePeak).toBeGreaterThan(normal.summary.acetaldehydePeak * 3);
    expect(deficient.summary.predictedHrvDropPct).toBeGreaterThan(normal.summary.predictedHrvDropPct);
  });

  it("dilutes BAC across a larger volume of distribution", () => {
    const small = simulate({
      profile: profile({ weightKg: 52, bodyFatPct: 30 }),
      session: session([beer(40)]),
      at: BASE + HOUR,
    });
    const large = simulate({
      profile: profile({ weightKg: 95, bodyFatPct: 12 }),
      session: session([beer(40)]),
      at: BASE + HOUR,
    });
    expect(large.summary.peakBac).toBeLessThan(small.summary.peakBac);
  });

  it("returns an uncertainty band around the point estimate", () => {
    const result = simulate({
      profile: profile(),
      session: session([beer(35)]),
      at: BASE + 45 * 60_000,
    });
    const now = result.summary;
    expect(now.confidence.bacLow).toBeLessThanOrEqual(now.currentBac);
    expect(now.confidence.bacHigh).toBeGreaterThanOrEqual(now.currentBac);
    expect(now.confidence.bacHigh - now.confidence.bacLow).toBeGreaterThan(0.005);
  });

  it("sums multi-drink doses and reports standard drinks", () => {
    const result = simulate({
      profile: profile(),
      session: session([beer(14, BASE), beer(14, BASE + 30 * 60_000)]),
      at: BASE + HOUR,
    });
    expect(result.summary.totalEthanolG).toBeCloseTo(28, 4);
    expect(result.summary.standardDrinks).toBeCloseTo(2, 2);
  });

  it("stays at zero with no drinks", () => {
    const result = simulate({
      profile: profile(),
      session: session([]),
      at: BASE,
    });
    expect(result.summary.currentBac).toBe(0);
    expect(result.summary.peakBac).toBe(0);
    expect(result.summary.clearanceAt).toBeNull();
  });
});

describe("personal headroom", () => {
  it("uses a lower reference for women", () => {
    const male = computeHeadroom(profile({ sex: "male" }), 0, BASE).ceilingG;
    const female = computeHeadroom(profile({ sex: "female" }), 0, BASE).ceilingG;
    expect(male).toBeGreaterThanOrEqual(20);
    expect(male).toBeLessThanOrEqual(23);
    expect(female).toBeGreaterThanOrEqual(10);
    expect(female).toBeLessThan(male);
  });

  it("halves the reference for ALDH2 *1/*2", () => {
    const reduced = computeHeadroom(
      profile({ genetics: { adh1b: "intermediate", adh1c: "intermediate", aldh2: "reduced" } }),
      0,
      BASE,
    );
    expect(reduced.ceilingG).toBeLessThanOrEqual(12);
    expect(reduced.drivers.some((d) => d.label.includes("ALDH2"))).toBe(true);
  });

  it("returns zero during pregnancy and with cirrhosis", () => {
    const pregnant = profile({ conditions: { liver: "none", diabetes: "none", hypertension: false, pregnancy: true } });
    expect(computeHeadroom(pregnant, 0, BASE).ceilingG).toBe(0);

    const cirrhosis = profile({ conditions: { liver: "cirrhosis", diabetes: "none", hypertension: false, pregnancy: false } });
    expect(computeHeadroom(cirrhosis, 0, BASE).ceilingG).toBe(0);
  });

  it("subtracts today's drinks and never goes negative", () => {
    const h = computeHeadroom(profile(), 30, BASE);
    expect(h.consumedG).toBe(30);
    expect(h.remainingG).toBe(0);
    expect(h.usedPct).toBe(100);
  });
});

describe("chronic markers", () => {
  it("computes FIB-4 and bands it", () => {
    const low = computeFib4(33, 25, 30, 250);
    expect(low.value).toBeCloseTo(0.6025, 2);
    expect(low.band).toBe("low");

    const high = computeFib4(60, 90, 40, 90);
    expect(high.band).toBe("high");
  });

  it("calibrates PEth into a plausible range for sustained drinking", () => {
    const now = new Date(2026, 9, 23, 12).getTime();
    const history = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 9, 23 - i);
      history.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        grams: 30,
        standardDrinks: 2.1,
      });
    }
    const peth = estimatePeth(history, now);
    expect(peth.ngMl).toBeGreaterThan(70);
    expect(peth.ngMl).toBeLessThan(140);
  });

  it("scores a heavier example record above a lighter one", () => {
    const now = new Date(2026, 9, 23, 12).getTime();
    const demo = makeDemoHistory(now);
    const light = demo.map((d) => ({ ...d, grams: 0, standardDrinks: 0 }));
    const heavy = demo.map((d) => ({ ...d, grams: d.grams * 2, standardDrinks: d.standardDrinks * 2 }));

    const lightScore = computeAllostatic(profile(), light, now);
    const demoScore = computeAllostatic(profile(), demo, now);
    const heavyScore = computeAllostatic(profile(), heavy, now);

    expect(lightScore.score).toBeLessThan(demoScore.score);
    expect(demoScore.score).toBeLessThan(heavyScore.score);
    expect(demoScore.score).toBeGreaterThanOrEqual(0);
    expect(demoScore.score).toBeLessThanOrEqual(100);
  });
});

describe("demo fixtures", () => {
  it("simulates the demo session without NaNs", () => {
    const now = Date.now();
    const result = simulate({
      profile: makeDemoProfile(),
      session: makeDemoSession(now),
      at: now,
      stepMinutes: 2,
    });
    expect(Number.isFinite(result.summary.currentBac)).toBe(true);
    expect(result.summary.currentBac).toBeGreaterThan(0);
    expect(result.samples.every((s) => Number.isFinite(s.bac))).toBe(true);
    expect(result.summary.headroom.ceilingG).toBeGreaterThan(0);
  });

  it("computes ethanol mass independently of serving size", () => {
    expect(drinkEthanolGrams({ volumeMl: 330, abv: 5 })).toBeCloseTo(13.02, 1);
  });
});
