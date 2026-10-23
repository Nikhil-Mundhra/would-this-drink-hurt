import { z } from "zod";

const genotypeAdh1b = z.enum(["slow", "intermediate", "fast", "unknown"]);
const genotypeAdh1c = z.enum(["fast", "intermediate", "slow", "unknown"]);
const genotypeAldh2 = z.enum(["active", "reduced", "minimal", "unknown"]);

const labsSchema = z
  .object({
    collectedAt: z.string().max(32).optional(),
    pethNgMl: z.number().min(0).max(2000).nullable().optional(),
    ggtUaL: z.number().min(0).max(2000).nullable().optional(),
    astUaL: z.number().min(0).max(2000).nullable().optional(),
    altUaL: z.number().min(0).max(2000).nullable().optional(),
    plateletsKUl: z.number().min(1).max(1000).nullable().optional(),
    ferritinNgMl: z.number().min(0).max(10000).nullable().optional(),
    triglyceridesMgDl: z.number().min(0).max(2000).nullable().optional(),
    uricAcidMgDl: z.number().min(0).max(30).nullable().optional(),
    hba1cPct: z.number().min(2).max(20).nullable().optional(),
  })
  .nullable();

export const profileSchema = z.object({
  name: z.string().min(1).max(80),
  age: z.number().int().min(18).max(100),
  sex: z.enum(["male", "female"]),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(35).max(300),
  bodyFatPct: z.number().min(3).max(62).nullable(),
  genetics: z.object({
    adh1b: genotypeAdh1b,
    adh1c: genotypeAdh1c,
    aldh2: genotypeAldh2,
  }),
  conditions: z.object({
    liver: z.enum(["none", "fatty", "fibrosis", "cirrhosis"]),
    diabetes: z.enum(["none", "type1", "type2"]),
    hypertension: z.boolean(),
    pregnancy: z.boolean(),
  }),
  medications: z.array(
    z.enum([
      "acetaminophen",
      "ssri",
      "antihistamine",
      "benzodiazepine",
      "opioid",
      "nsaid",
      "insulin",
      "sulfonylurea",
      "statin",
      "ppi",
      "oralContraceptive",
      "warfarin",
      "methotrexate",
    ]),
  ).max(20),
  baseline: z.object({
    restingHr: z.number().min(30).max(160),
    hrvMs: z.number().min(1).max(300),
    sleepHours: z.number().min(0).max(14),
    hydrationPct: z.number().min(0).max(100),
    stress: z.number().min(0).max(10),
    weeklyExerciseMinutes: z.number().min(0).max(3000),
  }),
  labs: labsSchema,
});

const drinkSchema = z.object({
  id: z.string().min(1).max(64),
  at: z.number().int().positive(),
  volumeMl: z.number().min(1).max(3000),
  abv: z.number().min(0).max(96),
  label: z.string().min(1).max(80),
  carbonated: z.boolean().optional(),
});

const mealSchema = z.object({
  id: z.string().min(1).max(64),
  at: z.number().int().positive(),
  size: z.enum(["snack", "meal", "large"]),
  fat: z.enum(["low", "medium", "high"]),
  protein: z.enum(["low", "medium", "high"]),
});

const waterSchema = z.object({
  id: z.string().min(1).max(64),
  at: z.number().int().positive(),
  volumeMl: z.number().min(0).max(5000),
});

const sensorSchema = z.object({
  at: z.number().int().positive(),
  heartRate: z.number().min(30).max(220).optional(),
  hrvMs: z.number().min(1).max(300).optional(),
  glucoseMgDl: z.number().min(20).max(600).optional(),
  skinTempC: z.number().min(30).max(42).optional(),
  simulated: z.boolean().optional(),
});

const readingSchema = z.object({
  at: z.number().int().positive(),
  bac: z.number().min(0).max(0.6),
  source: z.string().min(1).max(80),
});

export const sessionSchema = z.object({
  startedAt: z.number().int().positive(),
  drinks: z.array(drinkSchema).max(60),
  meals: z.array(mealSchema).max(30),
  waters: z.array(waterSchema).max(60),
  sensors: z.array(sensorSchema).max(500),
  readings: z.array(readingSchema).max(50),
});

const dailyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grams: z.number().min(0).max(1000),
  standardDrinks: z.number().min(0).max(100),
  sleepHours: z.number().min(0).max(14).optional(),
  restingHr: z.number().min(30).max(200).optional(),
  hrvMs: z.number().min(1).max(300).optional(),
  note: z.string().max(240).optional(),
});

export const simulateSchema = z.object({
  profile: profileSchema,
  session: sessionSchema,
  at: z.number().int().positive().optional(),
  horizonHours: z.number().min(2).max(30).optional(),
  stepMinutes: z.number().min(0.5).max(10).optional(),
});

export const headroomSchema = z.object({
  profile: profileSchema,
  consumedG: z.number().min(0).max(1000),
  at: z.number().int().positive().optional(),
});

export const historySchema = z.object({
  profile: profileSchema,
  history: z.array(dailyLogSchema).max(400),
  at: z.number().int().positive().optional(),
});
