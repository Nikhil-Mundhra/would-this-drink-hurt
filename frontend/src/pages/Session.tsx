import { useMemo, useState } from "react";
import {
  BeerStein,
  CheckCircle,
  Clock,
  Drop,
  ForkKnife,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  ShieldWarning,
  Trash,
  Warning,
  Wine,
  Martini,
  ArrowCounterClockwise,
  X,
  ClockCounterClockwise,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { useStore, useNow } from "../lib/store";
import { useSimulation } from "../lib/useSimulation";
import { formatTime, bacDisplay, grams } from "../lib/format";
import { DRINK_PRESETS, type DrinkPreset } from "../lib/data";
import { BEVERAGE_DATABASE, type BeverageItem } from "../lib/beverageDatabase";
import { BacChart } from "../components/BacChart";
import { AcetaldehydeChart, MiniMeter } from "../components/charts";

type LogTab = "drink" | "food" | "water";

const SEARCH_PRESETS_KEY = "wtdh.search_presets.v1";

export interface DynamicPreset {
  id: string;
  label: string;
  detail: string;
  volumeMl: number;
  abv: number;
  isRecent?: boolean;
}

function loadSearchPresets(): DynamicPreset[] {
  try {
    const raw = window.localStorage.getItem(SEARCH_PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function SessionPage() {
  const { state, now, addDrink, removeDrink, addMeal, removeMeal, addWater, resetSession } = useStore();
  const { session } = state;
  const simulation = useSimulation();
  const { summary } = simulation;

  // Dynamic search history presets
  const [recentPresets, setRecentPresets] = useState<DynamicPreset[]>(loadSearchPresets);

  const addRecentPreset = (preset: DynamicPreset) => {
    setRecentPresets((prev) => {
      const filtered = prev.filter(
        (p) => !(p.label.toLowerCase() === preset.label.toLowerCase() && p.abv === preset.abv)
      );
      const updated = [preset, ...filtered].slice(0, 6);
      try {
        window.localStorage.setItem(SEARCH_PRESETS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentPresets = () => {
    setRecentPresets([]);
    try {
      window.localStorage.removeItem(SEARCH_PRESETS_KEY);
    } catch {}
  };

  // Dynamic 1-tap presets: search history items first, padded with defaults up to 6
  const displayPresets = useMemo<DynamicPreset[]>(() => {
    const combined: DynamicPreset[] = [...recentPresets];
    for (const def of DRINK_PRESETS) {
      if (combined.length >= 6) break;
      const exists = combined.some(
        (c) => c.label.toLowerCase() === def.label.toLowerCase() || (c.volumeMl === def.volumeMl && c.abv === def.abv)
      );
      if (!exists) {
        combined.push({
          id: def.id,
          label: def.label,
          detail: def.detail,
          volumeMl: def.volumeMl,
          abv: def.abv,
          isRecent: false,
        });
      }
    }
    return combined;
  }, [recentPresets]);

  // Time selector state
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);
  const [customTime, setCustomTime] = useState<string>("");
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<LogTab>("drink");

  // Drink search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCustomDrink, setShowCustomDrink] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>("");
  const [customVolume, setCustomVolume] = useState<number>(330);
  const [customAbv, setCustomAbv] = useState<number>(5.0);

  // Calculate timestamp based on selector
  const selectedTimestamp = useMemo(() => {
    if (useCustomTime && customTime) {
      const [hours, minutes] = customTime.split(":").map(Number);
      const d = new Date(now);
      d.setHours(hours, minutes, 0, 0);
      return d.getTime();
    }
    return now - timeOffsetMinutes * 60_000;
  }, [now, timeOffsetMinutes, useCustomTime, customTime]);

  // Filtered beverage database
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return BEVERAGE_DATABASE.filter(
      (b) =>
        b["Brand Name"].toLowerCase().includes(q) ||
        b["Specific Product / Expression"].toLowerCase().includes(q) ||
        b["Sub-Type"].toLowerCase().includes(q) ||
        b["Category"].toLowerCase().includes(q),
    ).slice(0, 8);
  }, [searchQuery]);

  // Risk Classification
  const riskInfo = useMemo(() => {
    const bac = summary.currentBac;
    const peak = summary.peakBac;

    if (bac < 0.005 && session.drinks.length === 0) {
      return {
        tier: "CLEAR",
        label: "Clear / Zero Risk",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        bgBanner: "border-[var(--color-line)] bg-[var(--color-surface)]",
        icon: ShieldCheck,
        summary: "No active alcohol load detected.",
        advice: "Normal metabolic baseline. Safe to drive.",
        color: "#10b981",
      };
    }

    if (bac < 0.04 && peak < 0.05) {
      return {
        tier: "LOW",
        label: "Low Risk",
        badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        bgBanner: "border-emerald-500/30 bg-emerald-950/10",
        icon: ShieldCheck,
        summary: "Mild relaxation. Low metabolic strain.",
        advice: "Coordination is largely intact. Moderate pacing recommended.",
        color: "#10b981",
      };
    }

    if (bac < 0.08 && peak < 0.08) {
      return {
        tier: "MEDIUM",
        label: "Medium Risk",
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        bgBanner: "border-amber-500/30 bg-amber-950/10",
        icon: Warning,
        summary: "Noticeable reaction time delay & sensory reduction.",
        advice: "Driving and operating machinery are unsafe. Tonight's REM sleep will be reduced.",
        color: "#f59e0b",
      };
    }

    return {
      tier: "HIGH",
      label: "High Risk",
      badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      bgBanner: "border-rose-500/30 bg-rose-950/15",
      icon: ShieldWarning,
      summary: "Significant cognitive & motor impairment.",
      advice: "Do not drive. High acetaldehyde accumulation. Hydrate with water and rest.",
      color: "#f43f5e",
    };
  }, [summary.currentBac, summary.peakBac, session.drinks.length]);

  // Progressive disclosure for BAC details
  const [showBacDetails, setShowBacDetails] = useState<boolean>(false);

  // Water & food buffer stats
  const totalWaterMl = useMemo(() => {
    return session.waters.reduce((sum, w) => sum + w.volumeMl, 0);
  }, [session.waters]);

  const foodStatus = useMemo(() => {
    const meals = [...session.meals].sort((a, b) => b.at - a.at);
    if (meals.length === 0) {
      return {
        hasFood: false,
        label: "Empty Stomach",
        description: "Alcohol absorbs quickly into the duodenum without food. Eating now buffers remaining absorption.",
      };
    }
    const last = meals[0];
    const sizeName = last.size === "snack" ? "Light Snack" : last.size === "large" ? "Heavy / High-Fat Meal" : "Balanced Meal";
    return {
      hasFood: true,
      label: `${sizeName} Buffered`,
      description: `Active buffer logged at ${formatTime(last.at)}. Retains ethanol in stomach, delaying peak by 30-45m and reducing peak BAC by ~20%.`,
    };
  }, [session.meals]);

  const waterStatus = useMemo(() => {
    if (totalWaterMl >= 750) {
      return {
        label: `Well Hydrated (${totalWaterMl} ml)`,
        statusClass: "bg-sky-500/10 text-sky-400 border-sky-500/25",
        description: "Healthy fluid balance. Mitigates vasopressin suppression and morning dehydration headache.",
      };
    }
    if (totalWaterMl >= 250) {
      return {
        label: `Moderate (${totalWaterMl} ml)`,
        statusClass: "bg-blue-500/10 text-blue-400 border-blue-500/25",
        description: "Good baseline. Aim for 1 glass of water per alcoholic drink to offset diuretic loss.",
      };
    }
    return {
      label: "0 ml Logged",
      statusClass: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      description: "Alcohol suppresses anti-diuretic hormone (ADH). Drink water to protect hydration.",
    };
  }, [totalWaterMl]);

  // Handlers
  const handleLogDynamicDrink = (preset: DynamicPreset) => {
    addDrink(
      {
        volumeMl: preset.volumeMl,
        abv: preset.abv,
        label: preset.label,
      },
      selectedTimestamp,
    );
  };

  const handleLogDatabaseDrink = (bev: BeverageItem) => {
    const label = `${bev["Brand Name"]} - ${bev["Specific Product / Expression"]}`;
    addDrink(
      {
        volumeMl: bev["Standard Serving Size (ml)"],
        abv: bev["Standard ABV (%)"],
        label,
      },
      selectedTimestamp,
    );
    addRecentPreset({
      id: `rec-${bev["Brand Name"]}-${bev["Specific Product / Expression"]}`,
      label: bev["Brand Name"],
      detail: `${bev["Specific Product / Expression"]} · ${bev["Standard Serving Size (ml)"]}ml · ${bev["Standard ABV (%)"]}%`,
      volumeMl: bev["Standard Serving Size (ml)"],
      abv: bev["Standard ABV (%)"],
      isRecent: true,
    });
    setSearchQuery("");
  };

  const handleLogCustomDrink = () => {
    if (!customName.trim() || customVolume <= 0 || customAbv <= 0) return;
    addDrink(
      {
        volumeMl: customVolume,
        abv: customAbv,
        label: customName.trim(),
      },
      selectedTimestamp,
    );
    addRecentPreset({
      id: `rec-custom-${customName.trim()}`,
      label: customName.trim(),
      detail: `${customVolume} ml · ${customAbv}%`,
      volumeMl: customVolume,
      abv: customAbv,
      isRecent: true,
    });
    setShowCustomDrink(false);
    setCustomName("");
  };

  const handleLogMeal = (size: "snack" | "meal" | "large", fat: "low" | "medium" | "high", protein: "low" | "medium" | "high") => {
    addMeal(
      {
        size,
        fat,
        protein,
      },
      selectedTimestamp,
    );
  };

  const handleLogWater = (volumeMl: number) => {
    addWater(volumeMl, selectedTimestamp);
  };

  // Combine timeline events
  const timelineEvents = useMemo(() => {
    const list: Array<{
      id: string;
      at: number;
      type: "drink" | "meal" | "water";
      title: string;
      subtitle: string;
    }> = [];

    session.drinks.forEach((d) => {
      const pureG = d.volumeMl * (d.abv / 100) * 0.78924;
      list.push({
        id: d.id,
        at: d.at,
        type: "drink",
        title: d.label,
        subtitle: `${d.volumeMl} ml · ${d.abv}% ABV · ${pureG.toFixed(1)}g alcohol`,
      });
    });

    session.meals.forEach((m) => {
      const sizeLabel = m.size === "snack" ? "Light Snack" : m.size === "large" ? "Heavy / High-Fat Meal" : "Balanced Meal";
      list.push({
        id: m.id,
        at: m.at,
        type: "meal",
        title: sizeLabel,
        subtitle: `Buffers peak absorption · Fat: ${m.fat} · Protein: ${m.protein}`,
      });
    });

    session.waters.forEach((w) => {
      list.push({
        id: w.id,
        at: w.at,
        type: "water",
        title: "Water",
        subtitle: `${w.volumeMl} ml hydration`,
      });
    });

    return list.sort((a, b) => b.at - a.at);
  }, [session]);

  const IconRisk = riskInfo.icon;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. TOP HERO AREA: ALCOHOL & RISK WIDGET + FOOD & WATER WIDGET */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WIDGET 1: ALCOHOL & RISK STATUS (SIMPLE AT FIRST GLANCE) */}
        <div className={`p-5 rounded-xl border ${riskInfo.bgBanner} shadow-md flex flex-col justify-between transition-all`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border ${riskInfo.badgeClass}`}>
                <IconRisk size={15} weight="bold" />
                {riskInfo.label.toUpperCase()}
              </span>
              {session.drinks.length > 0 && (
                <button
                  type="button"
                  onClick={resetSession}
                  className="btn btn-sm text-[11px] text-muted hover:text-ink flex items-center gap-1"
                  title="Reset current session"
                >
                  <ArrowCounterClockwise size={12} />
                  Reset
                </button>
              )}
            </div>

            <h1 className="text-[20px] sm:text-[24px] font-semibold text-ink mt-3 tracking-tight">
              {riskInfo.summary}
            </h1>
            <p className="text-[12px] text-muted mt-1 leading-relaxed">
              {riskInfo.advice}
            </p>
          </div>

          {/* Progressive Disclosure Toggle for BAC / Peak / Sober In */}
          <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
            <button
              type="button"
              onClick={() => setShowBacDetails((prev) => !prev)}
              className="flex items-center justify-between w-full py-1 text-[12px] font-medium text-muted hover:text-ink transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span>{showBacDetails ? "Hide BAC & Time Stats" : "Show BAC & Time to Sober"}</span>
                {session.drinks.length > 0 && !showBacDetails && (
                  <span className="font-mono text-[11px] text-ink bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded">
                    {bacDisplay(summary.currentBac)}% BAC
                  </span>
                )}
              </span>
              {showBacDetails ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </button>

            {/* Hidden until clicked */}
            {showBacDetails && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[var(--color-line)] animate-in fade-in duration-200">
                <div className="stat">
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Current BAC</span>
                  <div className="metric text-[20px] sm:text-[24px] font-mono text-ink mt-0.5">
                    {bacDisplay(summary.currentBac)}
                    <span className="text-[11px] font-normal text-muted ml-1">%</span>
                  </div>
                  <span className="text-[10px] text-faint">blood alcohol</span>
                </div>

                <div className="stat">
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Projected Peak</span>
                  <div className="metric text-[20px] sm:text-[24px] font-mono text-ink mt-0.5">
                    {bacDisplay(summary.peakBac)}
                    <span className="text-[11px] font-normal text-muted ml-1">%</span>
                  </div>
                  <span className="text-[10px] text-faint">
                    {summary.peakBacAt ? `at ${formatTime(summary.peakBacAt)}` : "no active peak"}
                  </span>
                </div>

                <div className="stat">
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Sober In</span>
                  <div className="metric text-[20px] sm:text-[24px] font-mono text-ink mt-0.5">
                    {summary.minutesToClearance && summary.minutesToClearance > 0
                      ? `${Math.floor(summary.minutesToClearance / 60)}h ${summary.minutesToClearance % 60}m`
                      : "0m"}
                  </div>
                  <span className="text-[10px] text-faint">
                    {summary.clearanceAt ? `clear at ${formatTime(summary.clearanceAt)}` : "currently clear"}
                  </span>
                </div>

                <div className="stat">
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Total Consumed</span>
                  <div className="metric text-[20px] sm:text-[24px] font-mono text-ink mt-0.5">
                    {summary.standardDrinks.toFixed(1)}
                    <span className="text-[11px] font-normal text-muted ml-1">drinks</span>
                  </div>
                  <span className="text-[10px] text-faint">{grams(summary.totalEthanolG)} pure ethanol</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WIDGET 2: WATER & FOOD STATS (NEXT TO IT) */}
        <div className="panel p-5 rounded-xl border border-[var(--color-line)] shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-line)]">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
                <ForkKnife size={14} className="text-[var(--color-warn)]" />
                <Drop size={14} className="text-sky-400" />
                Stomach Buffer &amp; Hydration
              </span>
              <span className="text-[11px] text-faint">
                {session.meals.length} {session.meals.length === 1 ? "meal" : "meals"} · {totalWaterMl} ml water
              </span>
            </div>

            {/* Food Buffer Status */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                  <ForkKnife size={14} className="text-[var(--color-warn)]" />
                  Food Absorption Buffer
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  foodStatus.hasFood
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                }`}>
                  {foodStatus.label}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                {foodStatus.description}
              </p>
            </div>

            {/* Water Hydration Status */}
            <div className="mt-3.5 pt-3 border-t border-[var(--color-line)]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                  <Drop size={14} className="text-sky-400" />
                  Hydration Balance
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  waterStatus.statusClass
                }`}>
                  {waterStatus.label}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                {waterStatus.description}
              </p>
            </div>
          </div>

          {/* Quick Water Action Buttons */}
          <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted font-medium">Quick Hydrate:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => addWater(250)}
                className="btn btn-sm text-[11px] py-1 px-2.5 flex items-center gap-1 text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
              >
                <Drop size={12} /> +250ml
              </button>
              <button
                type="button"
                onClick={() => addWater(500)}
                className="btn btn-sm text-[11px] py-1 px-2.5 flex items-center gap-1 text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
              >
                <Drop size={12} /> +500ml
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("food")}
                className="btn btn-sm text-[11px] py-1 px-2.5 flex items-center gap-1 text-[var(--color-warn)] border-amber-500/30 hover:bg-amber-500/10"
              >
                <ForkKnife size={12} /> +Food
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TIME-STAMPED LOGGING CONTROLS */}
      <div className="panel p-5 sm:p-6 shadow-md">
        {/* TIME STAMP SELECTOR BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-2 text-ink font-medium text-[14px]">
            <Clock size={18} className="text-[var(--color-accent)]" />
            <span>When did you have this?</span>
          </div>

          {/* Quick Time Offsets */}
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            {[
              { label: "Just now", offset: 0 },
              { label: "15m ago", offset: 15 },
              { label: "30m ago", offset: 30 },
              { label: "45m ago", offset: 45 },
              { label: "1h ago", offset: 60 },
              { label: "2h ago", offset: 120 },
            ].map((chip) => (
              <button
                key={chip.offset}
                type="button"
                onClick={() => {
                  setTimeOffsetMinutes(chip.offset);
                  setUseCustomTime(false);
                }}
                className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-all ${
                  !useCustomTime && timeOffsetMinutes === chip.offset
                    ? "bg-[var(--color-accent)] text-black font-semibold shadow-sm"
                    : "border border-[var(--color-line)] text-muted hover:text-ink hover:border-[var(--color-line-strong)]"
                }`}
              >
                {chip.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setUseCustomTime(true)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-all ${
                useCustomTime
                  ? "bg-[var(--color-accent)] text-black font-semibold shadow-sm"
                  : "border border-[var(--color-line)] text-muted hover:text-ink"
              }`}
            >
              Specific Time
            </button>
          </div>

          {useCustomTime && (
            <div className="w-full sm:w-auto flex items-center gap-2 mt-2 sm:mt-0">
              <span className="text-[12px] text-muted">Select time:</span>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="input py-1 px-2 text-[13px] font-mono"
              />
            </div>
          )}
        </div>

        {/* LOG SELECTOR TABS: DRINK / FOOD / WATER */}
        <div className="flex items-center gap-2 pt-4 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("drink")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              activeTab === "drink"
                ? "bg-[rgba(195,242,90,0.15)] text-[var(--color-accent)] border border-[rgba(195,242,90,0.3)]"
                : "text-muted hover:text-ink"
            }`}
          >
            <BeerStein size={16} /> Log Drink
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("food")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              activeTab === "food"
                ? "bg-[rgba(240,180,85,0.15)] text-[var(--color-warn)] border border-[rgba(240,180,85,0.3)]"
                : "text-muted hover:text-ink"
            }`}
          >
            <ForkKnife size={16} /> Log Food
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("water")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              activeTab === "water"
                ? "bg-[rgba(100,180,255,0.15)] text-sky-400 border border-[rgba(100,180,255,0.3)]"
                : "text-muted hover:text-ink"
            }`}
          >
            <Drop size={16} /> Log Water
          </button>
        </div>

        {/* TAB CONTENT: DRINK */}
        {activeTab === "drink" && (
          <div className="space-y-4">
            {/* Quick 1-Tap Drink Presets (Dynamic as per search history) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                    Quick Presets (1-Tap)
                  </span>
                  {recentPresets.length > 0 && (
                    <span className="text-[10px] text-[var(--color-accent)] font-medium flex items-center gap-1">
                      <ClockCounterClockwise size={11} /> Personal Favorites
                    </span>
                  )}
                </div>
                {recentPresets.length > 0 && (
                  <button
                    type="button"
                    onClick={clearRecentPresets}
                    className="text-[11px] text-muted hover:text-ink underline underline-offset-2 transition-colors"
                  >
                    Reset to defaults
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {displayPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLogDynamicDrink(preset)}
                    className="flex flex-col items-start p-3 rounded-lg border border-[var(--color-line)] hover:border-[var(--color-accent)] hover:bg-[rgba(195,242,90,0.04)] text-left transition-all group relative"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[13px] font-medium text-ink group-hover:text-[var(--color-accent)] truncate max-w-[85%]">
                        {preset.label}
                      </span>
                      <Plus size={13} className="text-muted group-hover:text-[var(--color-accent)] shrink-0" />
                    </div>
                    <span className="text-[11px] text-muted mt-1 truncate max-w-full">{preset.detail}</span>
                    {preset.isRecent && (
                      <span className="mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[rgba(195,242,90,0.12)] text-[var(--color-accent)] border border-[rgba(195,242,90,0.25)]">
                        Recent Search
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Search Bar from 75-item Database */}
            <div className="pt-2">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-2">
                Or Search Curated Brands & Expressions (75 Products)
              </span>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted flex items-center z-10">
                  <MagnifyingGlass size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Search brand (e.g. Guinness, Absolut, Heineken, Tito's, Casamigos, Baileys)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "38px", paddingRight: searchQuery ? "36px" : "12px" }}
                  className="input w-full text-[13px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] divide-y divide-[var(--color-line)] max-h-60 overflow-y-auto shadow-xl">
                  {searchResults.map((bev) => (
                    <button
                      key={`${bev["Brand Name"]}-${bev["Specific Product / Expression"]}`}
                      type="button"
                      onClick={() => handleLogDatabaseDrink(bev)}
                      className="w-full p-2.5 flex items-center justify-between text-left hover:bg-[rgba(195,242,90,0.06)] transition-all group"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-ink group-hover:text-[var(--color-accent)]">
                          {bev["Brand Name"]} · {bev["Specific Product / Expression"]}
                        </div>
                        <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                          <span>{bev["Sub-Type"]}</span>
                          <span>·</span>
                          <span className="font-mono">{bev["Standard ABV (%)"]}% ABV</span>
                          <span>·</span>
                          <span>{bev["Standard Serving Size (ml)"]} ml</span>
                          <span>·</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            bev.Congener_Level_3_Tier === "Low"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : bev.Congener_Level_3_Tier === "Medium"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {bev.Congener_Level_3_Tier} Congeners
                          </span>
                        </div>
                      </div>
                      <Plus size={16} className="text-muted group-hover:text-[var(--color-accent)] mr-2 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Drink Toggle */}
            <div className="pt-2">
              {!showCustomDrink ? (
                <button
                  type="button"
                  onClick={() => setShowCustomDrink(true)}
                  className="text-[12px] text-muted hover:text-ink underline underline-offset-4"
                >
                  + Log custom volume & ABV
                </button>
              ) : (
                <div className="p-4 rounded-lg border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-ink">Custom Drink</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomDrink(false)}
                      className="text-[11px] text-muted hover:text-ink"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Drink name (e.g. Craft Double IPA)"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="input text-[13px]"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder="Volume"
                        value={customVolume}
                        onChange={(e) => setCustomVolume(Number(e.target.value))}
                        className="input text-[13px] font-mono w-full"
                      />
                      <span className="text-[12px] text-muted">ml</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ABV %"
                        value={customAbv}
                        onChange={(e) => setCustomAbv(Number(e.target.value))}
                        className="input text-[13px] font-mono w-full"
                      />
                      <span className="text-[12px] text-muted">%</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogCustomDrink}
                    className="btn btn-sm btn-primary"
                  >
                    Add Custom Drink
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: FOOD */}
        {activeTab === "food" && (
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
              Choose Food Intake (Buffers Peak BAC & Delays Absorption)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleLogMeal("snack", "low", "medium")}
                className="p-4 rounded-lg border border-[var(--color-line)] hover:border-[var(--color-warn)] hover:bg-[rgba(240,180,85,0.05)] text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink group-hover:text-[var(--color-warn)]">
                    🥪 Light Snack
                  </span>
                  <Plus size={14} className="text-muted group-hover:text-[var(--color-warn)]" />
                </div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Pretzels, fruit, crackers, or light cheese. Modest slowing of stomach emptying.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleLogMeal("meal", "medium", "medium")}
                className="p-4 rounded-lg border border-[var(--color-line)] hover:border-[var(--color-warn)] hover:bg-[rgba(240,180,85,0.05)] text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink group-hover:text-[var(--color-warn)]">
                    🍽️ Balanced Meal
                  </span>
                  <Plus size={14} className="text-muted group-hover:text-[var(--color-warn)]" />
                </div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Full lunch/dinner with protein & complex carbs. Cuts peak BAC by ~20% and delays absorption by 30–45 min.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleLogMeal("large", "high", "high")}
                className="p-4 rounded-lg border border-[var(--color-line)] hover:border-[var(--color-warn)] hover:bg-[rgba(240,180,85,0.05)] text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink group-hover:text-[var(--color-warn)]">
                    🥩 Heavy / High-Fat Meal
                  </span>
                  <Plus size={14} className="text-muted group-hover:text-[var(--color-warn)]" />
                </div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Pizza, burger, steak, rich pasta. Maximally retains alcohol in stomach, buffering up to 30% of peak BAC.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* TAB CONTENT: WATER */}
        {activeTab === "water" && (
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
              Log Water (Hydration & Hangover Mitigation)
            </span>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleLogWater(250)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[var(--color-line)] hover:border-sky-400 hover:bg-sky-950/20 text-ink text-[13px] font-medium transition-all"
              >
                <Drop size={16} className="text-sky-400" />
                + Glass of Water (250 ml)
              </button>
              <button
                type="button"
                onClick={() => handleLogWater(500)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[var(--color-line)] hover:border-sky-400 hover:bg-sky-950/20 text-ink text-[13px] font-medium transition-all"
              >
                <Drop size={16} className="text-sky-400" />
                + Bottle of Water (500 ml)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. BLOOD ALCOHOL CURVE */}
      <div className="panel p-5 sm:p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Projected BAC & Clearance Curve</h2>
            <p className="text-[12px] text-muted">
              Pharmacokinetic two-compartment model showing absorption, peak, and liver clearance rate.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Low (&lt;0.04)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Med (0.04–0.08)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> High (&gt;0.08)
            </span>
          </div>
        </div>

        <BacChart result={simulation} session={session} at={now} />
      </div>

      {/* 3b. OPTIONAL ADVANCED BIOMARKERS & SLEEP IMPACT ACCORDION */}
      <details className="panel p-5 sm:p-6 shadow-md border border-[var(--color-line)] group">
        <summary className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink flex items-center justify-between list-none">
          <span className="flex items-center gap-2">
            <span>🔬</span>
            <span>Advanced Biomarkers &amp; Sleep Impact (Acetaldehyde, REM, HRV)</span>
          </span>
          <span className="text-[11px] text-[var(--color-accent)] underline underline-offset-4">
            Click to view / hide
          </span>
        </summary>

        <div className="mt-5 pt-4 border-t border-[var(--color-line)] space-y-5">
          {/* Acetaldehyde curve */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-ink">
                Acetaldehyde Hepatic Accumulation (Toxic Intermediate)
              </span>
              <span className="text-[11px] font-mono text-[var(--color-warn)]">
                Peak: {summary.acetaldehydePeak?.toFixed(1) ?? "0.0"} µM
              </span>
            </div>
            <p className="text-[11px] text-muted mb-3">
              Acetaldehyde is the Group 1 carcinogen responsible for facial flushing, nausea, and morning hangover.
            </p>
            <AcetaldehydeChart samples={simulation.samples} at={now} height={140} />
          </div>

          {/* Sleep & recovery meters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[var(--color-line)]">
            <MiniMeter
              label="REM Sleep Suppression"
              value={`${Math.round(summary.estimatedRemSuppressionPct)}%`}
              pct={summary.estimatedRemSuppressionPct}
              tone={summary.estimatedRemSuppressionPct > 30 ? "danger" : summary.estimatedRemSuppressionPct > 15 ? "warn" : "safe"}
              caption="Reduces neural memory consolidation & dream architecture."
            />
            <MiniMeter
              label="Sleep Heart Rate Rise"
              value={`+${Math.round(summary.predictedSleepHrDelta)} BPM`}
              pct={(summary.predictedSleepHrDelta / 20) * 100}
              tone={summary.predictedSleepHrDelta > 10 ? "danger" : summary.predictedSleepHrDelta > 4 ? "warn" : "safe"}
              caption="Autonomic sympathetic overdrive during nocturnal sleep."
            />
            <MiniMeter
              label="HRV Overnight Reduction"
              value={`-${Math.round(summary.predictedHrvDropPct)}%`}
              pct={summary.predictedHrvDropPct}
              tone={summary.predictedHrvDropPct > 35 ? "danger" : summary.predictedHrvDropPct > 15 ? "warn" : "safe"}
              caption="Vagal parasympathetic tone suppression."
            />
          </div>
        </div>
      </details>

      {/* 4. TODAY'S TIMELINE LOG */}
      <div className="panel p-5 sm:p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-[16px] font-semibold text-ink">Today's Intake Log</h2>
          </div>
          <span className="text-[12px] text-muted">
            {timelineEvents.length} {timelineEvents.length === 1 ? "entry" : "entries"} logged
          </span>
        </div>

        {timelineEvents.length === 0 ? (
          <div className="py-8 text-center text-muted text-[13px]">
            No drinks, meals, or water logged for today yet. Use the buttons above to log an entry!
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {timelineEvents.map((evt) => (
              <div key={evt.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-mono text-muted w-16">
                    {formatTime(evt.at)}
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-ink flex items-center gap-2">
                      {evt.type === "drink" && <BeerStein size={15} className="text-[var(--color-accent)]" />}
                      {evt.type === "meal" && <ForkKnife size={15} className="text-[var(--color-warn)]" />}
                      {evt.type === "water" && <Drop size={15} className="text-sky-400" />}
                      {evt.title}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{evt.subtitle}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (evt.type === "drink") removeDrink(evt.id);
                    if (evt.type === "meal") removeMeal(evt.id);
                  }}
                  className="text-muted hover:text-rose-400 p-1.5 rounded transition-colors"
                  title="Remove entry"
                >
                  <Trash size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
