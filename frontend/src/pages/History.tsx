import { useMemo, useState, type ReactNode } from "react";
import { Heartbeat, MoonStars, Plus, Trash } from "@phosphor-icons/react";
import {
  computeAllostatic,
  computeHeadroom,
  estimatePeth,
  type DailyLog,
} from "@wtdh/engine";
import { useStore, useNow } from "../lib/store";
import { Badge, Panel, Stat } from "../components/ui";
import { MiniMeter, TrendSparkline } from "../components/charts";
import { formatDateShort, todayKey } from "../lib/format";

export function HistoryPage() {
  const { state, now, upsertDay, removeDay } = useStore();
  const { profile, history } = state;
  const allostatic = useMemo(() => computeAllostatic(profile, history, now), [profile, history, now]);
  const peth = useMemo(() => estimatePeth(history, now), [history, now]);
  const headroom = useMemo(() => computeHeadroom(profile, 0, now), [profile, now]);
  const [date, setDate] = useState(todayKey(now));
  const [grams, setGrams] = useState<number | "">("");
  const [sleep, setSleep] = useState<number | "">("");
  const [note, setNote] = useState("");

  const recent = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [history],
  );

  const recovery = useMemo(() => {
    const drinking = history.filter((d) => d.grams > 0);
    const dry = history.filter((d) => d.grams === 0);
    const avg = (rows: DailyLog[], key: "sleepHours" | "hrvMs" | "restingHr") => {
      const values = rows.map((r) => r[key]).filter((v): v is number => v != null);
      return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
    };
    return {
      sleepDrinking: avg(drinking, "sleepHours"),
      sleepDry: avg(dry, "sleepHours"),
      hrvDrinking: avg(drinking, "hrvMs"),
      hrvDry: avg(dry, "hrvMs"),
      hrDrinking: avg(drinking, "restingHr"),
      hrDry: avg(dry, "restingHr"),
    };
  }, [history]);

  const days = useMemo(() => buildDays(history, now), [history, now]);
  const weeks = useMemo(() => {
    const first = days[0];
    const start = new Date(`${first.date}T12:00:00`);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(`${days[days.length - 1].date}T12:00:00`);
    const total = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const cols = Math.ceil(total / 7);
    return { start, cols };
  }, [days]);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">History / 90-day window</div>
          <h1 className="display mt-2 text-[clamp(1.7rem,2.6vw,2.35rem)]">The pattern, not the night.</h1>
          <p className="prose-b mt-2 max-w-[62ch] text-[12.5px]">
            One heavy night is an acute event. A repeated pattern changes the liver, sleep and
            cardiovascular baseline. This view scores the pattern.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={allostatic.band === "overloaded" ? "danger" : allostatic.band === "strained" ? "warn" : "safe"}>{allostatic.band}</Badge>
          <Badge>{history.length} days logged</Badge>
        </div>
      </div>

      <div className="stat-grid mb-4">
        <Stat label="Allostatic load" value={`${allostatic.score}/100`} sub="90-day composite" />
        <Stat label="Drinking days" value={allostatic.drinkingDays} sub={`of 90 · ${allostatic.restDays} dry`} />
        <Stat label="Heavy days" value={allostatic.heavyDays} sub={`> ${headroom.ceilingG} g reference`} />
        <Stat label="Longest run" value={`${allostatic.longestStreak} d`} sub="consecutive drinking days" />
      </div>

      <div className="history-grid">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Exposure calendar"
            subtitle="Each cell is one day. Intensity is ethanol load against your reference."
            right={<span className="micro">{formatDateShort(days[0].date)} – {formatDateShort(days[days.length - 1].date)}</span>}
            bodyClassName="panel-body"
          >
            <div className="flex gap-2">
              <div className="flex shrink-0 flex-col justify-between py-[1px] text-[8px] text-faint">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="heat-grid flex-1" style={{ gridTemplateColumns: `repeat(${weeks.cols}, 1fr)` }}>
                {Array.from({ length: weeks.cols * 7 }).map((_, i) => {
                  const d = new Date(weeks.start.getFullYear(), weeks.start.getMonth(), weeks.start.getDate() + i);
                  const key = todayKey(d.getTime());
                  const entry = dayMap.get(key);
                  const future = d.getTime() > new Date(`${todayKey(now)}T23:59:59`).getTime();
                  if (!entry && future) return <span key={i} className="heat-cell" style={{ opacity: 0.15 }} />;
                  const g = entry?.grams ?? 0;
                  const ratio = g / Math.max(1, headroom.ceilingG);
                  const bg =
                    g === 0
                      ? "rgba(160,200,180,0.055)"
                      : ratio <= 1
                        ? `rgba(195,242,90,${0.2 + ratio * 0.55})`
                        : ratio <= 2
                          ? `rgba(240,180,85,${0.45 + Math.min(0.4, (ratio - 1) * 0.4)})`
                          : "rgba(255,112,92,0.85)";
                  return (
                    <button
                      key={i}
                      type="button"
                      className="heat-cell"
                      style={{ background: bg }}
                      title={`${key} · ${g.toFixed(0)} g${entry?.sleepHours != null ? ` · ${entry.sleepHours} h sleep` : ""}`}
                      aria-label={`${key}: ${g.toFixed(0)} grams`}
                      onClick={() => {
                        setDate(key);
                        setGrams(entry?.grams ?? "");
                        setSleep(entry?.sleepHours ?? "");
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--color-line)] pt-3">
              <span className="micro">Load</span>
              {[0, 0.35, 0.7, 1.2, 2.2].map((r) => (
                <span key={r} className="flex items-center gap-1.5 text-[9px] text-faint">
                  <span
                    className="h-2.5 w-2.5"
                    style={{
                      background:
                        r === 0
                          ? "rgba(160,200,180,0.055)"
                          : r <= 1
                            ? `rgba(195,242,90,${0.2 + r * 0.55})`
                            : r <= 2
                              ? "rgba(240,180,85,0.75)"
                              : "rgba(255,112,92,0.85)",
                    }}
                  />
                  {r === 0 ? "dry" : r <= 1 ? "within" : r <= 2 ? "over" : "heavy"}
                </span>
              ))}
              <span className="ml-auto micro">Click a cell to edit that day.</span>
            </div>
          </Panel>

          <div className="two-col">
            <Panel title="Load composition" subtitle="Where the 90-day score comes from" bodyClassName="panel-body space-y-4">
              {allostatic.components.map((c) => (
                <MiniMeter
                  key={c.label}
                  label={c.label}
                  value={`${c.value.toFixed(0)} / ${c.max}`}
                  pct={(c.value / c.max) * 100}
                  tone={c.value / c.max > 0.66 ? "danger" : c.value / c.max > 0.33 ? "warn" : "safe"}
                  caption={c.detail}
                />
              ))}
            </Panel>

            <Panel title="Recovery signal" subtitle="Measured sleep and autonomic data in your record" bodyClassName="panel-body">
              <div className="space-y-3">
                <RecoveryRow
                  icon={<MoonStars size={14} />}
                  label="Sleep on drinking days"
                  value={recovery.sleepDrinking != null ? `${recovery.sleepDrinking.toFixed(1)} h` : "—"}
                  compare={recovery.sleepDry != null ? `${recovery.sleepDry.toFixed(1)} h on dry days` : "no dry-day data"}
                  delta={recovery.sleepDrinking != null && recovery.sleepDry != null ? recovery.sleepDrinking - recovery.sleepDry : null}
                  invert
                />
                <RecoveryRow
                  icon={<Heartbeat size={14} />}
                  label="HRV on drinking days"
                  value={recovery.hrvDrinking != null ? `${recovery.hrvDrinking.toFixed(0)} ms` : "—"}
                  compare={recovery.hrvDry != null ? `${recovery.hrvDry.toFixed(0)} ms on dry days` : "no dry-day data"}
                  delta={recovery.hrvDrinking != null && recovery.hrvDry != null ? recovery.hrvDrinking - recovery.hrvDry : null}
                />
                <RecoveryRow
                  icon={<Heartbeat size={14} />}
                  label="Resting HR"
                  value={recovery.hrDrinking != null ? `${recovery.hrDrinking.toFixed(0)} bpm` : "—"}
                  compare={recovery.hrDry != null ? `${recovery.hrDry.toFixed(0)} bpm on dry days` : "no dry-day data"}
                  delta={recovery.hrDrinking != null && recovery.hrDry != null ? recovery.hrDrinking - recovery.hrDry : null}
                  invert
                />
              </div>
              <p className="micro mt-4 border-t border-[var(--color-line)] pt-3">
                Correlation, not causation. Sleep and HRV also respond to stress, illness, heat
                and training. Trends across weeks are more informative than a single night.
              </p>
            </Panel>
          </div>

          <Panel
            title="Allostatic trend"
            subtitle="Rolling 14-day load, last 30 days"
            right={<Badge tone="accent">{peth.ngMl.toFixed(0)} ng/mL estimated PEth</Badge>}
            bodyClassName="panel-body pt-3"
          >
            <TrendSparkline data={allostatic.trend.map((t) => t.score)} height={72} />
            <div className="mt-2 flex justify-between text-[9px] text-faint">
              <span>{formatDateShort(allostatic.trend[0]?.date ?? todayKey(now))}</span>
              <span>today</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--color-line)] pt-3">
              <div>
                <div className="label">Avg / day</div>
                <div className="metric mt-1 text-[15px]">{allostatic.averageGrams.toFixed(1)} g</div>
              </div>
              <div>
                <div className="label">Rest days</div>
                <div className="metric mt-1 text-[15px]">{allostatic.restDays}</div>
              </div>
              <div>
                <div className="label">PEth estimate</div>
                <div className="metric mt-1 text-[15px]">{peth.ngMl.toFixed(0)} ng/mL</div>
              </div>
            </div>
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel title="Log a day" subtitle="Retrospective entries change the chronic view, not tonight's curve" bodyClassName="panel-body">
            <div className="space-y-3">
              <label className="field">
                <span>Date</span>
                <input type="date" className="input" value={date} max={todayKey(now)} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Ethanol</span>
                <span className="field-unit">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <em>g</em>
                </span>
                <span className="field-help">
                  {grams !== "" ? `≈ ${(Number(grams) / 14).toFixed(1)} US drinks` : "Use grams if you know the pour; a US drink is 14 g."}
                </span>
              </label>
              <label className="field">
                <span>Sleep that night</span>
                <span className="field-unit">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={14}
                    step={0.25}
                    placeholder="optional"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <em>h</em>
                </span>
              </label>
              <label className="field">
                <span>Note</span>
                <input className="input" maxLength={160} value={note} placeholder="optional" onChange={(e) => setNote(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={!date || grams === ""}
                onClick={() => {
                  if (!date || grams === "") return;
                  upsertDay({
                    date,
                    grams: Math.max(0, Number(grams)),
                    standardDrinks: Math.max(0, Number(grams)) / 14,
                    sleepHours: sleep === "" ? undefined : Number(sleep),
                    note: note || undefined,
                  });
                  setNote("");
                }}
              >
                <Plus size={12} /> Save day
              </button>
            </div>
          </Panel>

          <Panel title="Recent days" subtitle="Tap a day to edit it" bodyClassName="panel-body pt-1">
            {recent.length === 0 ? (
              <div className="py-5">
                <p className="text-[12px] text-muted">No days logged.</p>
                <p className="micro mt-1">A 90-day record is what makes the chronic view meaningful.</p>
              </div>
            ) : (
              <div>
                {recent.map((d) => (
                  <div key={d.date} className="row row-tight">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setDate(d.date);
                        setGrams(d.grams);
                        setSleep(d.sleepHours ?? "");
                        setNote(d.note ?? "");
                      }}
                    >
                      <div className="text-[11px] text-ink">{formatDateShort(d.date)}</div>
                      <div className="micro">
                        {d.grams.toFixed(0)} g · {(d.grams / 14).toFixed(1)} drinks
                        {d.sleepHours != null ? ` · ${d.sleepHours} h` : ""}
                      </div>
                    </button>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.grams === 0 ? "bg-[var(--color-faint)]" : d.grams > headroom.ceilingG ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent)]"}`} />
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${d.date}`} onClick={() => removeDay(d.date)}>
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="PEth estimate" subtitle="Exponential decay model" bodyClassName="panel-body">
            <div className="metric text-[32px] leading-none">{peth.ngMl.toFixed(0)} <span className="text-[11px] text-faint">ng/mL</span></div>
            <div className="mt-2"><Badge tone={peth.band === "heavy" || peth.band === "very-heavy" ? "danger" : peth.band === "moderate" ? "warn" : "safe"}>{peth.band}</Badge></div>
            <div className="mt-3 space-y-1.5 border-t border-[var(--color-line)] pt-3">
              <div className="flex justify-between text-[10px]"><span className="text-muted">Last 30 days</span><span className="metric">{peth.last30dGrams.toFixed(0)} g</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted">Half-life</span><span className="metric">{peth.halfLifeDays} d</span></div>
            </div>
            <p className="micro mt-3">A lab PEth supersedes this estimate. The model cannot know dose accuracy or individual synthesis rates.</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function buildDays(history: DailyLog[], now: number): DailyLog[] {
  const map = new Map(history.map((d) => [d.date, d]));
  const end = new Date(now);
  const out: DailyLog[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const key = todayKey(d.getTime());
    out.push(map.get(key) ?? { date: key, grams: 0, standardDrinks: 0 });
  }
  return out;
}

function RecoveryRow({
  icon,
  label,
  value,
  compare,
  delta,
  invert = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  compare: string;
  delta: number | null;
  invert?: boolean;
}) {
  const bad = delta != null && (invert ? delta < 0 : delta > 0);
  return (
    <div className="flex items-start gap-2.5 border-b border-[var(--color-line)] pb-3 last:border-0 last:pb-0">
      <span className="mt-0.5 text-[var(--color-faint)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-ink">{label}</div>
        <div className="micro">{compare}</div>
      </div>
      <div className="text-right">
        <div className="metric text-[13px] text-ink">{value}</div>
        {delta != null && (
          <div className={`micro ${bad ? "text-[var(--color-danger)]" : "text-[var(--color-safe)]"}`}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}
