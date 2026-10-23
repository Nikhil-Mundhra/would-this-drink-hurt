import { useState } from "react";
import { User, X, Check, Scales, GenderIntersex } from "@phosphor-icons/react";
import { useStore } from "../lib/store";

export function ProfileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, updateProfile } = useStore();
  const { profile } = state;

  const [weightKg, setWeightKg] = useState(profile.weightKg || 75);
  const [sex, setSex] = useState<"male" | "female">(profile.sex || "male");
  const [age, setAge] = useState(profile.age || 30);
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");

  if (!open) return null;

  const displayWeight = unit === "kg" ? weightKg : Math.round(weightKg * 2.20462);

  const handleWeightChange = (val: number) => {
    if (unit === "kg") {
      setWeightKg(val);
    } else {
      setWeightKg(Math.round(val / 2.20462));
    }
  };

  const handleSave = () => {
    updateProfile((p) => ({
      ...p,
      weightKg: Math.max(35, Math.min(250, weightKg)),
      sex,
      age: Math.max(18, Math.min(100, age)),
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel max-w-[440px] w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
          <div className="flex items-center gap-2">
            <User size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-[16px] font-medium text-ink">Body Calibration</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-[12px] text-muted leading-relaxed">
          Your body weight and biological sex determine your total body water volume, which directly scales peak blood alcohol concentration (BAC).
        </p>

        <div className="mt-5 space-y-4">
          {/* Sex Selection */}
          <div>
            <label className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-1.5">
              Biological Sex
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSex("male")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-[13px] font-medium transition-all ${
                  sex === "male"
                    ? "border-[var(--color-accent)] bg-[rgba(195,242,90,0.12)] text-ink"
                    : "border-[var(--color-line)] text-muted hover:text-ink"
                }`}
              >
                <GenderIntersex size={16} /> Male (~68% body water)
              </button>
              <button
                type="button"
                onClick={() => setSex("female")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-[13px] font-medium transition-all ${
                  sex === "female"
                    ? "border-[var(--color-accent)] bg-[rgba(195,242,90,0.12)] text-ink"
                    : "border-[var(--color-line)] text-muted hover:text-ink"
                }`}
              >
                <GenderIntersex size={16} /> Female (~55% body water)
              </button>
            </div>
          </div>

          {/* Body Weight */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
                Body Weight
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUnit("kg")}
                  className={`px-1.5 py-0.5 rounded ${unit === "kg" ? "text-ink font-semibold" : "text-faint"}`}
                >
                  kg
                </button>
                <span className="text-faint">/</span>
                <button
                  type="button"
                  onClick={() => setUnit("lbs")}
                  className={`px-1.5 py-0.5 rounded ${unit === "lbs" ? "text-ink font-semibold" : "text-faint"}`}
                >
                  lbs
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Scales size={18} className="text-muted" />
              <input
                type="number"
                value={displayWeight}
                onChange={(e) => handleWeightChange(Number(e.target.value))}
                min={unit === "kg" ? 35 : 77}
                max={unit === "kg" ? 220 : 485}
                className="input flex-1 text-[16px] font-mono"
              />
              <span className="text-[13px] text-muted w-8">{unit}</span>
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-1.5">
              Age (Years)
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              min={18}
              max={100}
              className="input w-full text-[15px] font-mono"
            />
          </div>

          {/* Deep Clinical Modules Link */}
          <div className="pt-3 border-t border-[var(--color-line)]">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-2">
              Advanced Clinical Modules
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <a
                href="#/baseline"
                onClick={onClose}
                className="p-2 rounded border border-[var(--color-line)] text-muted hover:text-ink hover:border-[var(--color-line-strong)]"
              >
                Genetics &amp; Meds
              </a>
              <a
                href="#/labs"
                onClick={onClose}
                className="p-2 rounded border border-[var(--color-line)] text-muted hover:text-ink hover:border-[var(--color-line-strong)]"
              >
                Liver &amp; Blood Labs
              </a>
              <a
                href="#/method"
                onClick={onClose}
                className="p-2 rounded border border-[var(--color-line)] text-muted hover:text-ink hover:border-[var(--color-line-strong)]"
              >
                Math &amp; Citations
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--color-line)] pt-4">
          <button type="button" onClick={onClose} className="btn btn-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-sm btn-primary flex items-center gap-1.5"
          >
            <Check size={14} /> Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
}
