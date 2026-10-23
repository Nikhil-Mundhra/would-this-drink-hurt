import { useMemo, useState } from "react";
import {
  Calendar,
  ChartLine,
  CheckCircle,
  CurrencyDollar,
  Flame,
  Heartbeat,
  Info,
  Lifebuoy,
  Plus,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Trash,
  TrendUp,
  Warning,
} from "@phosphor-icons/react";
import { useStore, useNow } from "../lib/store";
import { formatDateShort, todayKey } from "../lib/format";
import { computeAllostatic, estimatePeth } from "@wtdh/engine";
import {
  computeLifespanImpact,
  compareLifespanPlans,
} from "../lib/lifespanStats";

export function HistoryPage() {
  const { state, now, upsertDay, removeDay } = useStore();
  const { profile, history, session } = state;

  const allostatic = useMemo(() => computeAllostatic(profile, history, now), [profile, history, now]);
  const peth = useMemo(() => estimatePeth(history, now), [history, now]);

  // Manual past day entry state
  const [logDate, setLogDate] = useState<string>(todayKey(now));
  const [logDrinks, setLogDrinks] = useState<number | "">("");
  const [logSleep, setLogSleep] = useState<number | "">("");
  const [logNote, setLogNote] = useState<string>("");

  // Calculate trailing weekly consumption
  const trailingStats = useMemo(() => {
    // If user has history entries, use them; if empty, use current session or default benchmark
    const daysWithHistory = history.length;
    let totalGrams = history.reduce((sum, d) => sum + (d.grams || d.standardDrinks * 14), 0);

    // Also include today's active session drinks if any
    const todayGrams = session.drinks.reduce(
      (sum, d) => sum + d.volumeMl * (d.abv / 100) * 0.78924,
      0,
    );

    let weeklyGrams = 0;
    let standardDrinksPerWeek = 0;
    let dryDaysPerWeek = 4;

    if (daysWithHistory >= 7) {
      // average over logged days scaled to 7 days
      const avgDailyGrams = totalGrams / daysWithHistory;
      weeklyGrams = avgDailyGrams * 7;
      standardDrinksPerWeek = weeklyGrams / 14;

      const nonDrinkingDays = history.filter((d) => d.grams === 0).length;
      dryDaysPerWeek = Math.round((nonDrinkingDays / daysWithHistory) * 7);
    } else if (todayGrams > 0) {
      // Estimate based on today's session projected across 2 typical weekend drinking days
      weeklyGrams = todayGrams * 2;
      standardDrinksPerWeek = weeklyGrams / 14;
      dryDaysPerWeek = 5;
    } else {
      // Default initial baseline: 8 standard drinks / week (~112g)
      weeklyGrams = 112;
      standardDrinksPerWeek = 8;
      dryDaysPerWeek = 4;
    }

    return {
      weeklyGrams,
      standardDrinksPerWeek: Number(standardDrinksPerWeek.toFixed(1)),
      dryDaysPerWeek,
      daysLogged: daysWithHistory,
    };
  }, [history, session.drinks]);

  // Target Slider state (default to 4 drinks/week - low risk zone)
  const [targetDrinks, setTargetDrinks] = useState<number>(4);

  // Lifespan impact of current intake
  const currentLifespan = useMemo(() => {
    return computeLifespanImpact(trailingStats.weeklyGrams, profile.age || 40);
  }, [trailingStats.weeklyGrams, profile.age]);

  // Comparison between current track and target plan
  const planComparison = useMemo(() => {
    const targetGrams = targetDrinks * 14;
    return compareLifespanPlans(
      trailingStats.weeklyGrams,
      targetGrams,
      profile.age || 40,
    );
  }, [trailingStats.weeklyGrams, targetDrinks, profile.age]);

  // Handle logging a past day
  const handleSaveDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDate) return;
    const drinks = logDrinks === "" ? 0 : Number(logDrinks);
    const grams = drinks * 14;

    upsertDay({
      date: logDate,
      grams,
      standardDrinks: drinks,
      sleepHours: logSleep === "" ? undefined : Number(logSleep),
      note: logNote.trim() || undefined,
    });

    setLogDrinks("");
    setLogSleep("");
    setLogNote("");
  };

  // Sorted recent entries
  const recentEntries = useMemo(() => {
    return [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  }, [history]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. EXECUTIVE LIFESPAN IMPACT BANNER */}
      <div className={`p-6 rounded-xl border shadow-lg transition-all ${
        currentLifespan.excessGrams === 0
          ? "border-emerald-500/30 bg-emerald-950/15"
          : currentLifespan.yearsLost >= 1.5
            ? "border-rose-500/30 bg-rose-950/15"
            : "border-amber-500/30 bg-amber-950/15"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold border ${
                currentLifespan.excessGrams === 0
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : currentLifespan.yearsLost >= 1.5
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}>
                <Heartbeat size={14} weight="bold" />
                LONG-TERM LONGEVITY PROJECTION
              </span>
              <span className="text-[12px] text-muted">
                Based on Lancet 599,000-participant cohort
              </span>
            </div>

            {currentLifespan.excessGrams === 0 ? (
              <div className="mt-3">
                <h1 className="text-[26px] font-bold text-emerald-400 tracking-tight">
                  Optimal Longevity Zone (0 Months Lost)
                </h1>
                <p className="text-[13px] text-muted mt-1 max-w-2xl leading-relaxed">
                  Your weekly load (~{trailingStats.standardDrinksPerWeek} drinks/wk, {Math.round(trailingStats.weeklyGrams)}g) is within the global clinical low-risk threshold (&lt;100g/week). There is statistically zero excess all-cause mortality.
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <h1 className="text-[26px] font-bold text-rose-400 tracking-tight">
                  -{currentLifespan.monthsLost} Months Projected Lifespan
                  {currentLifespan.yearsLost >= 1 && (
                    <span className="text-[18px] text-muted font-normal ml-2">
                      (-{currentLifespan.yearsLost} years)
                    </span>
                  )}
                </h1>
                <p className="text-[13px] text-muted mt-1 max-w-2xl leading-relaxed">
                  At an average load of <b>{trailingStats.standardDrinksPerWeek} drinks/week</b> ({Math.round(trailingStats.weeklyGrams)}g pure ethanol), excess mortality risk increases by <b>{Math.round((currentLifespan.hazardRatio - 1) * 100)}%</b> above the 100g/week Lancet threshold.
                </p>
              </div>
            )}
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex md:flex-col gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--color-line)]">
            <div className="text-right">
              <span className="text-[11px] text-muted uppercase tracking-wider block">Average Weekly Load</span>
              <span className="text-[20px] font-mono font-semibold text-ink">
                {trailingStats.standardDrinksPerWeek} <span className="text-[13px] font-normal text-muted">drinks</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted uppercase tracking-wider block">All-Cause Mortality HR</span>
              <span className="text-[20px] font-mono font-semibold text-ink">
                {currentLifespan.hazardRatio}x
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Risk Gradient Breakdown */}
        {currentLifespan.excessGrams > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-[var(--color-line)]">
            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--color-line)]">
              <span className="text-[11px] text-muted uppercase">Stroke Risk</span>
              <div className="text-[16px] font-mono text-ink mt-0.5">
                +{currentLifespan.strokeRiskPct}%
              </div>
              <span className="text-[10px] text-faint">elevated relative risk</span>
            </div>
            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--color-line)]">
              <span className="text-[11px] text-muted uppercase">Heart Failure Risk</span>
              <div className="text-[16px] font-mono text-ink mt-0.5">
                +{currentLifespan.heartFailureRiskPct}%
              </div>
              <span className="text-[10px] text-faint">myocardial stress</span>
            </div>
            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--color-line)]">
              <span className="text-[11px] text-muted uppercase">Hypertension Risk</span>
              <div className="text-[16px] font-mono text-ink mt-0.5">
                +{currentLifespan.hypertensionRiskPct}%
              </div>
              <span className="text-[10px] text-faint">vascular resistance</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. INTERACTIVE TARGET PLANNER ("WHAT-IF" SIMULATOR) */}
      <div className="panel p-6 shadow-md border border-[var(--color-line)]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkle size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-[18px] font-semibold text-ink">
            Interactive Lifespan Target Planner
          </h2>
        </div>
        <p className="text-[12px] text-muted leading-relaxed">
          Slide the target to see how moderating your weekly consumption statistically adds months to your life, cuts cardiovascular risk, and saves thousands in calories and money.
        </p>

        {/* Target Slider */}
        <div className="mt-6 p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--color-line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-ink">
              Planned Weekly Target:
            </span>
            <span className="text-[18px] font-mono font-bold text-[var(--color-accent)]">
              {targetDrinks} {targetDrinks === 1 ? "drink" : "drinks"} / week
              <span className="text-[12px] font-normal text-muted ml-1.5">
                ({targetDrinks * 14}g pure ethanol)
              </span>
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={28}
            step={1}
            value={targetDrinks}
            onChange={(e) => setTargetDrinks(Number(e.target.value))}
            className="w-full h-2 bg-[var(--color-line)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
          />

          <div className="flex justify-between text-[11px] text-muted mt-2 font-mono">
            <span>0 (Abstinence)</span>
            <span className="text-emerald-400 font-semibold">7 (Lancet Threshold: 100g)</span>
            <span>14 (Moderate)</span>
            <span>21 (Heavy)</span>
            <span>28 (Severe)</span>
          </div>
        </div>

        {/* OUTCOME CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {/* Lifespan Gained Card */}
          <div className="p-4 rounded-xl border border-[var(--color-accent)]/30 bg-[rgba(195,242,90,0.06)]">
            <div className="flex items-center gap-2 text-[var(--color-accent)] text-[12px] font-semibold uppercase tracking-wider">
              <TrendUp size={16} />
              Lifespan Reclaimed
            </div>
            <div className="metric text-[26px] font-mono font-bold text-ink mt-2">
              {planComparison.monthsGained > 0 ? (
                <>+{planComparison.monthsGained} <span className="text-[14px] font-normal text-muted">months</span></>
              ) : (
                <span className="text-[20px] text-emerald-400">Maintained Maximum</span>
              )}
            </div>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">
              {planComparison.monthsGained > 0
                ? `Shifting to ${targetDrinks} drinks/week reclaims ~${planComparison.monthsGained} months of life expectancy.`
                : "Your planned target is already within optimal longevity parameters."}
            </p>
          </div>

          {/* Annual Calorie Savings */}
          <div className="p-4 rounded-xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)]">
            <div className="flex items-center gap-2 text-amber-400 text-[12px] font-semibold uppercase tracking-wider">
              <Flame size={16} />
              Annual Calorie Shift
            </div>
            <div className="metric text-[26px] font-mono font-bold text-ink mt-2">
              {planComparison.annualCaloriesSaved > 0 ? (
                <>-{planComparison.annualCaloriesSaved.toLocaleString()} <span className="text-[13px] font-normal text-muted">kcal/yr</span></>
              ) : (
                <span className="text-[18px] text-muted font-normal">Baseline</span>
              )}
            </div>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">
              {planComparison.annualCaloriesSaved > 0
                ? `Equivalent to ~${(planComparison.annualCaloriesSaved / 3500).toFixed(1)} lbs of body fat avoided per year.`
                : "Minimal excess metabolic calorie accumulation."}
            </p>
          </div>

          {/* Annual Financial Savings */}
          <div className="p-4 rounded-xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)]">
            <div className="flex items-center gap-2 text-sky-400 text-[12px] font-semibold uppercase tracking-wider">
              <CurrencyDollar size={16} />
              Annual Financial Dividend
            </div>
            <div className="metric text-[26px] font-mono font-bold text-ink mt-2">
              {planComparison.annualDollarsSaved > 0 ? (
                <>+${planComparison.annualDollarsSaved.toLocaleString()} <span className="text-[13px] font-normal text-muted">/yr</span></>
              ) : (
                <span className="text-[18px] text-muted font-normal">Baseline</span>
              )}
            </div>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">
              Based on conservative $5/drink cost estimate.
            </p>
          </div>
        </div>

        {/* Actionable Weekly Blueprint */}
        <div className="mt-5 p-4 rounded-lg bg-[rgba(0,0,0,0.25)] border border-[var(--color-line)]">
          <span className="text-[11px] font-medium text-[var(--color-accent)] uppercase tracking-wider block mb-1">
            Clinical Recommendation for {targetDrinks} Drinks / Week
          </span>
          <p className="text-[12px] text-ink leading-relaxed">
            {targetDrinks === 0 && "Complete abstinence eliminates all ethanol-mediated oxidative stress, optimizes sleep architecture, and completely protects hepatic tissue."}
            {targetDrinks > 0 && targetDrinks <= 4 && `Distribute your ${targetDrinks} drinks across 1-2 days (e.g. 2 drinks Friday, 2 drinks Saturday). Maintain 5 consecutive alcohol-free days to allow complete liver recovery.`}
            {targetDrinks > 4 && targetDrinks <= 7 && `Consume a maximum of 2 drinks per occasion across 3 sessions (e.g. Wednesday, Friday, Saturday). Always preserve at least 4 alcohol-free days per week.`}
            {targetDrinks > 7 && "Spreading this intake into smaller daily doses is less damaging than binge sessions, but overall load still exceeds the 100g/week longevity ceiling."}
          </p>
        </div>
      </div>

      {/* 3. LOG A PAST DAY & HISTORY */}
      <div className="panel p-6 shadow-md border border-[var(--color-line)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-[16px] font-semibold text-ink">Past Day Logger</h2>
          </div>
          <span className="text-[12px] text-muted">Track history to refine statistical accuracy</span>
        </div>

        <form onSubmit={handleSaveDay} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted uppercase block mb-1">Date</label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="input w-full text-[13px] font-mono"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted uppercase block mb-1">Standard Drinks</label>
            <input
              type="number"
              step="0.5"
              min={0}
              placeholder="e.g. 2.0"
              value={logDrinks}
              onChange={(e) => setLogDrinks(e.target.value === "" ? "" : Number(e.target.value))}
              className="input w-full text-[13px] font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted uppercase block mb-1">Sleep (Hours)</label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={16}
              placeholder="e.g. 7.5"
              value={logSleep}
              onChange={(e) => setLogSleep(e.target.value === "" ? "" : Number(e.target.value))}
              className="input w-full text-[13px] font-mono"
            />
          </div>

          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-1.5 py-2">
              <Plus size={15} /> Save Day
            </button>
          </div>
        </form>

        {/* RECENT ENTRIES LIST */}
        <div className="mt-6 pt-5 border-t border-[var(--color-line)]">
          <span className="text-[12px] font-medium text-muted uppercase tracking-wider block mb-3">
            Recent Logged Days ({recentEntries.length})
          </span>

          {recentEntries.length === 0 ? (
            <p className="text-[12px] text-muted py-4 text-center">
              No historical days logged yet. Log past days above to personalize your long-term model.
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {recentEntries.map((day) => (
                <div key={day.date} className="py-2.5 flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-ink w-24">{formatDateShort(day.date)}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      day.standardDrinks === 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : day.standardDrinks <= 2
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {day.standardDrinks === 0 ? "0 drinks (Dry)" : `${day.standardDrinks.toFixed(1)} drinks (${Math.round(day.grams)}g)`}
                    </span>
                    {day.sleepHours != null && (
                      <span className="text-muted text-[11px]">· {day.sleepHours}h sleep</span>
                    )}
                    {day.note && (
                      <span className="text-faint text-[11px] italic truncate max-w-xs">"{day.note}"</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeDay(day.date)}
                    className="text-muted hover:text-rose-400 p-1"
                    title="Delete log"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. OPTIONAL ADVANCED BLOOD & ALLOSTATIC BIOMARKERS ACCORDION */}
      <details className="panel p-6 shadow-md border border-[var(--color-line)] group">
        <summary className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink flex items-center justify-between list-none">
          <span className="flex items-center gap-2">
            <span>🔬</span>
            <span>Advanced Blood &amp; Liver Markers (PEth, Allostatic Strain Score)</span>
          </span>
          <span className="text-[11px] text-[var(--color-accent)] underline underline-offset-4">
            Click to view / hide
          </span>
        </summary>

        <div className="mt-5 pt-4 border-t border-[var(--color-line)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--color-line)]">
              <span className="text-[11px] font-medium text-muted uppercase">Estimated Blood PEth (Phosphatidylethanol)</span>
              <div className="metric text-[24px] font-mono font-bold text-ink mt-1">
                {peth.ngMl.toFixed(0)} <span className="text-[13px] font-normal text-muted">ng/mL</span>
              </div>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                peth.band === "abstinence" ? "bg-emerald-500/10 text-emerald-400" : peth.band === "low" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
              }`}>
                {peth.band} band
              </span>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">{peth.note}</p>
            </div>

            <div className="p-4 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--color-line)]">
              <span className="text-[11px] font-medium text-muted uppercase">Allostatic Chronic Strain Score</span>
              <div className="metric text-[24px] font-mono font-bold text-ink mt-1">
                {allostatic.score} <span className="text-[13px] font-normal text-muted">/ 100</span>
              </div>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                allostatic.band === "restorative" ? "bg-emerald-500/10 text-emerald-400" : allostatic.band === "stable" ? "bg-blue-500/10 text-blue-400" : "bg-rose-500/10 text-rose-400"
              }`}>
                {allostatic.band} load
              </span>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                Aggregates 90-day exposure, binge frequency, and biomarker stress on hepatic tissue.
              </p>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
