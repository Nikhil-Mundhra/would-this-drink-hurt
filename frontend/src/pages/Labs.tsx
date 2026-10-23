import { useMemo } from "react";
import { Flask, Info, WarningCircle } from "@phosphor-icons/react";
import {
  computeAllostatic,
  estimatePeth,
  interpretLabs,
  type LabPanel,
} from "@wtdh/engine";
import { useStore, useNow } from "../lib/store";
import { Badge, Panel } from "../components/ui";
import { bandLabel, formatDateShort } from "../lib/format";

type LabKey = keyof Omit<LabPanel, "collectedAt">;

const GROUPS: {
  title: string;
  note: string;
  fields: { key: LabKey; label: string; unit: string; hint: string; min: number; max: number; step?: number }[];
}[] = [
  {
    title: "Exposure",
    note: "Direct evidence of ethanol exposure over weeks.",
    fields: [
      { key: "pethNgMl", label: "PEth", unit: "ng/mL", hint: "Clinical cutoffs: <20 low, 20–99 moderate, ≥100 heavy", min: 0, max: 2000 },
    ],
  },
  {
    title: "Hepatic panel",
    note: "Enzyme induction, inflammation and synthetic function.",
    fields: [
      { key: "ggtUaL", label: "GGT", unit: "U/L", hint: "Reference ≈ 10–60 (male), 6–42 (female)", min: 0, max: 2000 },
      { key: "astUaL", label: "AST", unit: "U/L", hint: "Reference ≈ 10–40", min: 0, max: 2000 },
      { key: "altUaL", label: "ALT", unit: "U/L", hint: "Reference ≈ 7–56", min: 0, max: 2000 },
      { key: "plateletsKUl", label: "Platelets", unit: "10⁹/L", hint: "Reference ≈ 150–400", min: 1, max: 1000 },
      { key: "ferritinNgMl", label: "Ferritin", unit: "ng/mL", hint: "Iron storage; rises with inflammation", min: 0, max: 10000 },
    ],
  },
  {
    title: "Metabolic",
    note: "Downstream consequences of ethanol metabolism.",
    fields: [
      { key: "triglyceridesMgDl", label: "Triglycerides", unit: "mg/dL", hint: "Optimal <150", min: 0, max: 2000 },
      { key: "uricAcidMgDl", label: "Uric acid", unit: "mg/dL", hint: "Alcohol raises urate production", min: 0, max: 30 },
      { key: "hba1cPct", label: "HbA1c", unit: "%", hint: "Three-month glucose average", min: 2, max: 20, step: 0.1 },
    ],
  },
];

export function LabsPage() {
  const { state, updateProfile } = useStore();
  const { profile, history } = state;
  const now = useNow();
  const labs = profile.labs;
  const panel = useMemo(() => interpretLabs(profile), [profile]);
  const peth = useMemo(() => estimatePeth(history, now), [history, now]);
  const allostatic = useMemo(() => computeAllostatic(profile, history, now), [profile, history, now]);

  function setLab(key: LabKey, value: number | "") {
    updateProfile((p) => ({ ...p, labs: { ...(p.labs ?? {}), [key]: value === "" ? null : value } }));
  }

  const hasAny = labs && Object.entries(labs).some(([k, v]) => k !== "collectedAt" && v != null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Labs / chronic exposure</div>
          <h1 className="display mt-2 text-[clamp(1.7rem,2.6vw,2.35rem)]">What the last month left behind.</h1>
          <p className="prose-b mt-2 max-w-[64ch] text-[12.5px]">
            Acute BAC says what is in your blood now. PEth, GGT and FIB-4 say what repeated
            exposure is doing to the liver and to long-term risk.
          </p>
        </div>
        <Badge tone={hasAny ? "accent" : "neutral"}>{hasAny ? "Panel entered" : "No panel yet"}</Badge>
      </div>

      <div className="labs-grid">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Blood panel"
            subtitle="Enter values from a lab report, or leave a field blank"
            right={
              <label className="flex items-center gap-2">
                <span className="label text-[8px]">Collected</span>
                <input
                  type="date"
                  className="input h-[28px] w-[126px] py-0 text-[10px]"
                  value={labs?.collectedAt ?? ""}
                  onChange={(e) => updateProfile((p) => ({ ...p, labs: { ...(p.labs ?? {}), collectedAt: e.target.value } }))}
                />
              </label>
            }
            bodyClassName="panel-body"
          >
            <div className="space-y-6">
              {GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <div className="label text-[9.5px] text-ink">{group.title}</div>
                    <span className="micro">{group.note}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <label key={field.key} className="field">
                        <span>{field.label} <span className="text-faint">· {field.unit}</span></span>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          min={field.min}
                          max={field.max}
                          step={field.step ?? "any"}
                          placeholder="—"
                          value={labs?.[field.key] ?? ""}
                          onChange={(e) => setLab(field.key, e.target.value === "" ? "" : Number(e.target.value))}
                        />
                        <span className="field-help">{field.hint}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="How these numbers combine" subtitle="Two indices carry most of the signal" bodyClassName="panel-body">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border border-[var(--color-line)] p-3.5">
                <div className="label">FIB-4</div>
                <div className="metric mt-1.5 text-[26px] leading-none">{panel.fib4 ? panel.fib4.value.toFixed(2) : "—"}</div>
                <div className="mt-2">
                  {panel.fib4 ? <Badge tone={panel.fib4.band === "high" ? "danger" : panel.fib4.band === "indeterminate" ? "warn" : "safe"}>{panel.fib4.band}</Badge> : <span className="micro">Needs age, AST, ALT, platelets</span>}
                </div>
                <p className="micro mt-2">{panel.fib4?.note ?? "A fibrosis index, not a diagnosis. FIB-4 is unreliable under 35 and in some chronic conditions."}</p>
                <div className="mt-2 border-t border-[var(--color-line)] pt-2 font-mono text-[9px] text-faint">
                  (age × AST) / (platelets × √ALT)
                </div>
              </div>

              <div className="border border-[var(--color-line)] p-3.5">
                <div className="label">AST / ALT ratio</div>
                <div className="metric mt-1.5 text-[26px] leading-none">{panel.astAltRatio ? panel.astAltRatio.toFixed(2) : "—"}</div>
                <div className="mt-2">
                  {panel.astAltRatio != null ? <Badge tone={panel.astAltRatio >= 2 ? "danger" : panel.astAltRatio > 1 ? "warn" : "neutral"}>{panel.astAltRatio >= 2 ? "alcohol pattern" : panel.astAltRatio > 1 ? "non-specific" : "below 1"}</Badge> : <span className="micro">Needs AST and ALT</span>}
                </div>
                <p className="micro mt-2">{panel.astAltNote ?? "A ratio above 2 is classically associated with alcohol-related injury, but it is neither sensitive nor specific."}</p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Exposure marker"
            subtitle="PEth is the most specific routine marker of drinking"
            right={<Badge tone={peth.band === "heavy" || peth.band === "very-heavy" ? "danger" : peth.band === "moderate" ? "warn" : "safe"}>{bandLabel(peth.band)}</Badge>}
            bodyClassName="panel-body"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="label">Lab PEth</div>
                <div className="metric mt-1 text-[30px] leading-none">{labs?.pethNgMl != null ? labs.pethNgMl.toFixed(0) : "—"}<span className="ml-1 text-[11px] text-faint">ng/mL</span></div>
              </div>
              <div className="text-right">
                <div className="label">Model estimate</div>
                <div className="metric mt-1 text-[20px] leading-none text-[var(--color-accent)]">{history.length ? peth.ngMl.toFixed(0) : "—"}</div>
                <div className="micro">ng/mL</div>
              </div>
            </div>
            <div className="mt-4 border-t border-[var(--color-line)] pt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Last 30 days</span>
                <span className="metric">{history.length ? `${peth.last30dGrams.toFixed(0)} g` : "no record"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-muted">Half-life</span>
                <span className="metric">{peth.halfLifeDays} days</span>
              </div>
            </div>
            <p className="micro mt-3">{peth.note}</p>
            {history.length === 0 && (
              <a href="#/history" className="btn btn-sm mt-3 w-full">Log a 90-day record to compare</a>
            )}
          </Panel>

          <Panel title="Marker status" subtitle="Out-of-range values, ordered by clinical weight" bodyClassName="panel-body">
            {hasAny ? (
              <div className="space-y-2.5">
                <MarkerRow label="PEth" value={labs?.pethNgMl} unit="ng/mL" band={peth.band === "abstinence" || peth.band === "low" ? "normal" : peth.band === "moderate" ? "elevated" : "high"} note={peth.band === "abstinence" ? "consistent with abstinence" : peth.band === "low" ? "low recent exposure" : peth.band === "moderate" ? "sustained exposure" : "heavy recent exposure"} />
                <MarkerRow label="GGT" value={panel.ggt?.value} unit="U/L" band={panel.ggt?.band} note="enzyme induction / biliary stress" />
                <MarkerRow label="Ferritin" value={panel.ferritin?.value} unit="ng/mL" band={panel.ferritin?.band} note="iron storage / inflammation" />
                <MarkerRow label="Triglycerides" value={panel.triglycerides?.value} unit="mg/dL" band={panel.triglycerides?.band} note="hepatic lipid output" />
                <MarkerRow label="Uric acid" value={panel.uricAcid?.value} unit="mg/dL" band={panel.uricAcid?.band} note="purine turnover" />
                <MarkerRow label="HbA1c" value={labs?.hba1cPct} unit="%" band={labs?.hba1cPct == null ? null : labs.hba1cPct < 5.7 ? "normal" : labs.hba1cPct < 6.5 ? "elevated" : "high"} note="glucose exposure" />
              </div>
            ) : (
              <div className="py-4">
                <div className="flex items-start gap-2.5">
                  <Flask size={16} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
                  <p className="micro">
                    No values yet. Labs are optional, but a single PEth plus a liver panel turns
                    the 90-day view from a self-report into a measured record.
                  </p>
                </div>
              </div>
            )}
            <p className="micro mt-3 border-t border-[var(--color-line)] pt-3">
              Reference ranges differ by lab and population. Treat the flags as prompts for a
              clinical conversation, not conclusions.
            </p>
          </Panel>

          <Panel
            title="Chronic load"
            subtitle="90-day allostatic score"
            right={<Badge tone={allostatic.band === "overloaded" ? "danger" : allostatic.band === "strained" ? "warn" : "safe"}>{allostatic.band}</Badge>}
            bodyClassName="panel-body"
          >
            <div className="flex items-end justify-between">
              <div>
                <div className="metric text-[40px] leading-none">{allostatic.score}<span className="ml-1 text-[12px] text-faint">/100</span></div>
                <div className="micro mt-1">{allostatic.drinkingDays} drinking days · {allostatic.heavyDays} heavy</div>
              </div>
              <a href="#/history" className="btn btn-sm">Open history</a>
            </div>
            <div className="mt-3 h-1.5 w-full bg-[var(--color-line)]">
              <div className="h-full" style={{ width: `${allostatic.score}%`, background: allostatic.score > 64 ? "var(--color-danger)" : allostatic.score > 39 ? "var(--color-warn)" : "var(--color-accent)" }} />
            </div>
            <p className="micro mt-3">
              Combines exposure, heavy-day frequency, estimated PEth, liver flags, recovery gaps
              and sleep. It is a trend indicator, not a diagnosis.
            </p>
          </Panel>

          <div className="flex items-start gap-2.5 border border-[var(--color-line)] p-3.5">
            <WarningCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-warn)]" />
            <p className="micro">
              A normal panel does not make heavy drinking safe. Liver enzymes can remain normal
              until fibrosis is advanced. PEth detects exposure, not organ damage.
            </p>
          </div>

          <div className="flex items-start gap-2.5 p-1">
            <Info size={13} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
            <p className="micro">
              Values are stored only in this browser. Nothing is sent to a server. If you need a
              clinical interpretation, take the original report to a clinician.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkerRow({
  label,
  value,
  unit,
  band,
  note,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  band: "normal" | "elevated" | "high" | null | undefined;
  note: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-ink">{label}</div>
        <div className="micro">{note}</div>
      </div>
      <span className="metric text-[11px] text-ink">{value != null ? value.toFixed(value < 10 ? 1 : 0) : "—"} <span className="text-[9px] text-faint">{unit}</span></span>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${band === "high" ? "bg-[var(--color-danger)]" : band === "elevated" ? "bg-[var(--color-warn)]" : band === "normal" ? "bg-[var(--color-safe)]" : "bg-[var(--color-faint)]"}`} />
    </div>
  );
}
