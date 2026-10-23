/**
 * Statistical models for long-term alcohol exposure and lifespan impact.
 * Primary citation: Wood AM, et al. "Risk thresholds for alcohol consumption:
 * combined analysis of individual-participant data for 599,912 current drinkers
 * in 83 prospective studies." The Lancet, 2018; 391(10129): 1513-1523.
 */

export interface LifespanProjection {
  weeklyGrams: number;
  standardDrinksPerWeek: number;
  thresholdGrams: number; // 100g / week (Lancet reference)
  excessGrams: number;
  monthsLost: number;
  monthsLostLow95: number;
  monthsLostHigh95: number;
  yearsLost: number;
  hazardRatio: number; // All-cause mortality HR (1.0 = reference)
  strokeRiskPct: number;
  heartFailureRiskPct: number;
  hypertensionRiskPct: number;
  annualCalories: number;
  annualCostEstUSD: number;
}

export function computeLifespanImpact(
  weeklyGrams: number,
  age = 40,
  dollarsPerDrink = 5.0,
): LifespanProjection {
  const standardDrinks = weeklyGrams / 14;
  const thresholdGrams = 100; // ~7 standard drinks / week
  const excessGrams = Math.max(0, weeklyGrams - thresholdGrams);

  // Age scaling factor relative to age 40 reference in Wood et al.
  const ageFactor = age > 0 ? Math.min(1.4, Math.max(0.6, (80 - age) / 40)) : 1.0;

  // Wood et al. 2018:
  // 100-200g/wk (~150g avg, 50g excess) -> ~6 months lost (0.5 yr)
  // 200-350g/wk (~275g avg, 175g excess) -> ~1-2 years lost (1.5 yr)
  // >350g/wk (~450g avg, 350g excess) -> ~4-5 years lost (4.5 yr)
  // Rate: approx ~0.156 months lost per gram of weekly excess above 100g for a 40-year old
  let monthsLost = 0;
  let monthsLostLow = 0;
  let monthsLostHigh = 0;

  if (excessGrams > 0) {
    monthsLost = excessGrams * 0.156 * ageFactor;
    monthsLostLow = excessGrams * 0.118 * ageFactor;
    monthsLostHigh = excessGrams * 0.198 * ageFactor;
  }

  const yearsLost = monthsLost / 12;

  // All-cause mortality HR: ~1.14 (14% increase) per 100g/week excess above 100g
  const hazardRatio = 1.0 + (excessGrams / 100) * 0.14;

  // Disease-specific excess risks per 100g/week excess (Wood et al. 2018)
  const strokeRiskPct = (excessGrams / 100) * 14;
  const heartFailureRiskPct = (excessGrams / 100) * 9;
  const hypertensionRiskPct = (excessGrams / 100) * 24;

  // Metabolic & financial burden:
  // Pure ethanol has 7 kcal/g; with congeners/mixers/carbs, practical intake ~9.5 kcal/g
  const annualCalories = Math.round(weeklyGrams * 9.5 * 52);
  const annualCostEstUSD = Math.round(standardDrinks * dollarsPerDrink * 52);

  return {
    weeklyGrams,
    standardDrinksPerWeek: Number(standardDrinks.toFixed(1)),
    thresholdGrams,
    excessGrams,
    monthsLost: Number(monthsLost.toFixed(1)),
    monthsLostLow95: Number(monthsLostLow.toFixed(1)),
    monthsLostHigh95: Number(monthsLostHigh.toFixed(1)),
    yearsLost: Number(yearsLost.toFixed(1)),
    hazardRatio: Number(hazardRatio.toFixed(2)),
    strokeRiskPct: Number(strokeRiskPct.toFixed(1)),
    heartFailureRiskPct: Number(heartFailureRiskPct.toFixed(1)),
    hypertensionRiskPct: Number(hypertensionRiskPct.toFixed(1)),
    annualCalories,
    annualCostEstUSD,
  };
}

export interface LifespanPlanComparison {
  current: LifespanProjection;
  target: LifespanProjection;
  monthsGained: number;
  yearsGained: number;
  hazardRatioReduction: number;
  annualCaloriesSaved: number;
  annualDollarsSaved: number;
}

export function compareLifespanPlans(
  currentWeeklyGrams: number,
  targetWeeklyGrams: number,
  age = 40,
): LifespanPlanComparison {
  const current = computeLifespanImpact(currentWeeklyGrams, age);
  const target = computeLifespanImpact(targetWeeklyGrams, age);

  const monthsGained = Math.max(0, Number((current.monthsLost - target.monthsLost).toFixed(1)));
  const yearsGained = Number((monthsGained / 12).toFixed(1));
  const hazardRatioReduction = Number(Math.max(0, current.hazardRatio - target.hazardRatio).toFixed(2));
  const annualCaloriesSaved = Math.max(0, current.annualCalories - target.annualCalories);
  const annualDollarsSaved = Math.max(0, current.annualCostEstUSD - target.annualCostEstUSD);

  return {
    current,
    target,
    monthsGained,
    yearsGained,
    hazardRatioReduction,
    annualCaloriesSaved,
    annualDollarsSaved,
  };
}
