import type { Adh1b, Adh1c, Aldh2, MedicationId, ReferenceItem } from "./types.js";

/** Density of ethanol at 20 °C, g/mL. */
export const ETHANOL_DENSITY = 0.789;

/**
 * Distribution coefficient converting grams of ethanol and litres of total body
 * water into blood alcohol concentration in g/dL.
 *
 * BAC(g/dL) = dose(g) / (TBW(L) × 13.7)
 *
 * The 13.7 combines the 10 dL/L conversion with the blood:water partition and
 * the empirical Widmark calibration (a 70 kg male with ~42 L TBW reaches about
 * 0.052 g/dL after 30 g of ethanol).
 */
export const BAC_DISTRIBUTION_COEFFICIENT = 13.7;

/** A US standard drink contains 14 g; WHO uses 10 g. We report both scales. */
export const GRAMS_PER_STANDARD_DRINK_US = 14;
export const GRAMS_PER_STANDARD_DRINK_WHO = 10;

/** Legal driving thresholds worth surfacing, g/dL. */
export const LEGAL_LIMITS = {
  zeroTolerance: 0.0,
  mostOfEurope: 0.05,
  us: 0.08,
} as const;

export const BAC_THRESHOLDS = {
  impairment: 0.02,
  noticeable: 0.04,
  legalMostOfEurope: 0.05,
  legalUS: 0.08,
  severe: 0.15,
} as const;

export const ADH1B_LABELS: Record<Adh1b, string> = {
  slow: "*1/*1 · slow oxidiser",
  intermediate: "*1/*2 · intermediate",
  fast: "*2/*2 · fast oxidiser",
  unknown: "Not tested",
};

export const ADH1C_LABELS: Record<Adh1c, string> = {
  fast: "*1/*1 · fast first-pass",
  intermediate: "*1/*2 · intermediate",
  slow: "*2/*2 · slow first-pass",
  unknown: "Not tested",
};

export const ALDH2_LABELS: Record<Aldh2, string> = {
  active: "*1/*1 · full clearance",
  reduced: "*1/*2 · reduced clearance",
  minimal: "*2/*2 · minimal clearance",
  unknown: "Not tested",
};

/** Relative ALDH2 catalytic capacity used by the acetaldehyde compartment. */
export const ALDH2_CAPACITY: Record<Aldh2, number> = {
  active: 1,
  reduced: 0.28,
  minimal: 0.06,
  unknown: 1,
};

/** Relative gastric ADH first-pass activity. */
export const ADH1B_GASTRIC: Record<Adh1b, number> = {
  slow: 0.85,
  intermediate: 1,
  fast: 1.35,
  unknown: 1,
};

/** Relative hepatic ethanol oxidation rate. */
export const ADH1B_HEPATIC: Record<Adh1b, number> = {
  slow: 0.94,
  intermediate: 1.02,
  fast: 1.1,
  unknown: 1,
};

export const ADH1C_GASTRIC: Record<Adh1c, number> = {
  fast: 1.08,
  intermediate: 1,
  slow: 0.88,
  unknown: 1,
};

export const MEDICATION_INFO: Record<
  MedicationId,
  { label: string; class: string; ceilingMultiplier: number; flags: string[] }
> = {
  acetaminophen: {
    label: "Acetaminophen / paracetamol",
    class: "CYP2E1 substrate",
    ceilingMultiplier: 0.75,
    flags: ["Competes with ethanol at CYP2E1; hepatotoxic risk rises with repeated drinking."],
  },
  ssri: {
    label: "SSRI antidepressant",
    class: "CNS / hepatic",
    ceilingMultiplier: 0.9,
    flags: ["Additive sedation and impaired coordination; some SSRIs inhibit CYP2D6."],
  },
  antihistamine: {
    label: "Sedating antihistamine",
    class: "CNS depressant",
    ceilingMultiplier: 0.9,
    flags: ["Additive sedation and next-day driving impairment."],
  },
  benzodiazepine: {
    label: "Benzodiazepine",
    class: "CNS depressant",
    ceilingMultiplier: 0.65,
    flags: ["Additive respiratory depression. Combining with alcohol is high risk."],
  },
  opioid: {
    label: "Opioid analgesic",
    class: "CNS depressant",
    ceilingMultiplier: 0.65,
    flags: ["Additive respiratory depression and sedation. Avoid alcohol."],
  },
  nsaid: {
    label: "NSAID",
    class: "GI / renal",
    ceilingMultiplier: 0.9,
    flags: ["Increases gastrointestinal bleeding risk when combined with ethanol."],
  },
  insulin: {
    label: "Insulin",
    class: "Glucose-lowering",
    ceilingMultiplier: 0.7,
    flags: ["Ethanol suppresses hepatic glucose release; hypoglycaemia risk is elevated."],
  },
  sulfonylurea: {
    label: "Sulfonylurea",
    class: "Glucose-lowering",
    ceilingMultiplier: 0.7,
    flags: ["Additive hypoglycaemia risk, including delayed overnight episodes."],
  },
  statin: {
    label: "Statin",
    class: "Hepatic",
    ceilingMultiplier: 0.95,
    flags: ["Monitor liver enzymes; risk is modest at low doses."],
  },
  ppi: {
    label: "Proton-pump inhibitor",
    class: "Gastric pH",
    ceilingMultiplier: 0.95,
    flags: ["Raises gastric pH, which can reduce gastric first-pass metabolism."],
  },
  oralContraceptive: {
    label: "Combined oral contraceptive",
    class: "Hormonal",
    ceilingMultiplier: 0.9,
    flags: ["May slow ethanol clearance and alter body-water distribution."],
  },
  warfarin: {
    label: "Warfarin",
    class: "Anticoagulant",
    ceilingMultiplier: 0.8,
    flags: ["Binge drinking destabilises INR and raises bleeding risk."],
  },
  methotrexate: {
    label: "Methotrexate",
    class: "Hepatotoxic",
    ceilingMultiplier: 0.5,
    flags: ["Additive liver toxicity. Clinically significant interaction."],
  },
};

export const REFERENCES: ReferenceItem[] = [
  {
    id: "widmark",
    title: "Widmark distribution and total body water",
    detail:
      "Blood alcohol is estimated from dose divided by total body water, with a blood:water partition coefficient. Body composition replaces the crude weight-only assumption.",
    source: "Widmark 1932; Watson et al., J Lab Clin Med 1980",
  },
  {
    id: "mm",
    title: "Michaelis-Menten ethanol elimination",
    detail:
      "Hepatic oxidation follows saturable kinetics. At social-drinking concentrations clearance is near zero-order (roughly 0.15 g/L/h) and slows as concentration approaches zero.",
    source: "Holford, Clin Pharmacokinet 1987; Jones, Forensic Sci Int 2010",
  },
  {
    id: "aldh2",
    title: "ALDH2 and acetaldehyde exposure",
    detail:
      "ALDH2*2 carriers clear acetaldehyde up to 10-20 times more slowly. Acetaldehyde is an IARC Group 1 carcinogen and the main driver of flushing, tachycardia and oesophageal cancer risk.",
    source: "IARC Monographs Vol. 100E; Chen et al., Nat Rev Gastroenterol Hepatol 2019",
  },
  {
    id: "firstpass",
    title: "Gastric first-pass metabolism",
    detail:
      "Gastric ADH can remove a meaningful fraction of a dose before absorption. Food delays gastric emptying and increases first-pass exposure, lowering peak BAC but prolonging it.",
    source: "Frezza et al., Gastroenterology 1990; Oneta et al., Gut 1998",
  },
  {
    id: "peth",
    title: "Phosphatidylethanol (PEth)",
    detail:
      "PEth is formed only when ethanol is present and has a 4-10 day half-life. It is the most specific routine biomarker of alcohol exposure over the preceding 2-4 weeks.",
    source: "Isaksson et al., Alcohol Clin Exp Res 2011; Ulwelling & Smith, J Anal Toxicol 2018",
  },
  {
    id: "sleep",
    title: "Alcohol and sleep architecture",
    detail:
      "Alcohol suppresses REM sleep, fragments the second half of the night and raises sympathetic tone. Effects persist after BAC returns to zero.",
    source: "Ebrahim et al., Alcohol Clin Exp Res 2013; Thakkar et al., Alcohol 2015",
  },
  {
    id: "fib4",
    title: "FIB-4 fibrosis index",
    detail:
      "FIB-4 combines age, AST, ALT and platelets. Values above 2.67 suggest advanced fibrosis and warrant clinical assessment; it is not a diagnosis.",
    source: "Sterling et al., Hepatology 2006",
  },
  {
    id: "no-safe",
    title: "No safe level of alcohol",
    detail:
      "The Global Burden of Disease analysis found that the safest level of alcohol consumption is none. This app models relative risk; it does not license drinking.",
    source: "GBD 2016 Alcohol Collaborators, Lancet 2018",
  },
];
