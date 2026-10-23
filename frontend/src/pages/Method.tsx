import { ArrowRight, Flask, Info, WarningCircle } from "@phosphor-icons/react";
import { REFERENCES } from "@wtdh/engine";
import { Badge, Panel } from "../components/ui";

const EQUATIONS = [
  {
    title: "Total body water",
    formula: "TBW = FFM × 0.73 + FM × 0.15",
    note: "Fat-free mass holds about 0.73 L of water per kg; adipose tissue holds about 0.15 L/kg. With no body-fat input, the Watson equation is used instead.",
  },
  {
    title: "Blood alcohol concentration",
    formula: "BAC(g/dL) = ethanol(g) / (TBW(L) × 13.7)",
    note: "The 13.7 combines the dL conversion with the blood:water partition and Widmark calibration. This is why fat mass and sex change the curve, not just weight.",
  },
  {
    title: "Gastric emptying",
    formula: "S(t) = S₀ · e^(−k_GE · t)",
    note: "A meal lengthens the gastric half-life from ~16 min toward ~90 min. Slower emptying lowers and delays the peak but prolongs exposure.",
  },
  {
    title: "First-pass metabolism",
    formula: "F = 1 − (0.05 + 0.14 · food + genotype)",
    note: "Gastric ADH removes part of the dose before it reaches circulation. Food increases this fraction; ADH1B*2 increases it further, at the cost of more acetaldehyde.",
  },
  {
    title: "Hepatic clearance",
    formula: "dC/dt = −Vmax · C / (Km + C)",
    note: "Saturable Michaelis–Menten kinetics. Clearance is near zero-order at social concentrations and slows as C approaches zero. Vmax starts at 0.17 g/L/h and is modified by age, genotype and liver status.",
  },
  {
    title: "Acetaldehyde",
    formula: "dA/dt = p · oxidation − k_ALDH2 · A",
    note: "A is acetaldehyde in µmol/L. ALDH2*2 reduces k by ~72% (heterozygote) or ~94% (homozygote), which turns a small ethanol flux into a large, persistent acetaldehyde pool.",
  },
  {
    title: "Personal reference",
    formula: "ceiling = reference × body-water × genotype × liver × medication",
    note: "Reference is 20 g/day for men and 10 g/day for women. Modifiers are multiplicative and visible in the headroom panel. Pregnancy and cirrhosis force the result to zero.",
  },
  {
    title: "PEth estimate",
    formula: "PEth ≈ 0.45 · Σ dose_d · 2^(−days/4.5)",
    note: "A forward estimate calibrated so ~30 g/day sustained lands near 90–120 ng/mL. A laboratory PEth always supersedes the estimate.",
  },
];

export function MethodPage() {
  return (
    <div>
      <div className="mb-5">
        <div className="label">Method / model card</div>
        <h1 className="display mt-2 text-[clamp(1.7rem,2.6vw,2.35rem)]">Every number has a derivation.</h1>
        <p className="prose-b mt-2 max-w-[68ch] text-[12.5px]">
          This is a deterministic physiological model, not a language model and not a medical
          device. The same inputs always produce the same curve. Where the model does not know,
          it widens the band instead of pretending precision.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="accent">Model v1.0</Badge>
        <Badge>Deterministic</Badge>
        <Badge>Local-first</Badge>
        <Badge tone="warn">Not clinically validated</Badge>
      </div>

      <div className="baseline-grid">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="The path of one dose" subtitle="Eight state changes, integrated at two-minute resolution" bodyClassName="panel-body">
            <ol className="relative ml-1 space-y-0">
              {[
                ["Ingestion", "Volume × ABV × 0.789 gives grams of ethanol. A 330 ml 5% lager is 13.0 g."],
                ["Stomach", "Ethanol waits in the stomach. Food, carbonation and concentration change how fast it empties."],
                ["First pass", "Gastric ADH oxidises a fraction before absorption. This is larger with food and with fast ADH1B."],
                ["Absorption", "The remainder enters the portal circulation, then the systemic compartment."],
                ["Distribution", "Dose divides into total body water, not total body weight. Fat is effectively excluded."],
                ["Oxidation", "The liver clears ethanol by saturable kinetics, producing acetaldehyde faster than some genotypes can clear it."],
                ["Acetaldehyde", "A separate compartment accumulates when ALDH2 capacity is low. This is the toxicity signal that BAC alone misses."],
                ["Outputs", "The curve is sampled for BAC, acetaldehyde, sympathetic strain, hypoglycaemia risk, sleep pressure and remaining headroom."],
              ].map(([title, body], i) => (
                <li key={title} className="relative flex gap-3.5 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--color-line-strong)] font-mono text-[9px] text-[var(--color-accent)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {i < 7 && <span className="mt-1 w-px flex-1 bg-[var(--color-line)]" />}
                  </div>
                  <div className="pb-1">
                    <div className="text-[12px] font-medium text-ink">{title}</div>
                    <p className="micro mt-0.5 max-w-[62ch]">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Core equations" subtitle="Units are explicit; no hidden fudge factors" bodyClassName="panel-body">
            <div className="grid gap-3 sm:grid-cols-2">
              {EQUATIONS.map((eq) => (
                <div key={eq.title} className="border border-[var(--color-line)] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="label text-[9px] text-ink">{eq.title}</div>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-[var(--color-accent)]">{eq.formula}</pre>
                  <p className="micro mt-2">{eq.note}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Uncertainty" subtitle="A point estimate without a band is a false claim" bodyClassName="panel-body">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="text-[12px] leading-relaxed text-muted">
                  The model runs three full simulations, not one: a central estimate, a lower-BAC
                  case (larger body water, slower absorption, faster clearance) and an upper-BAC
                  case (smaller body water, faster absorption, slower clearance). The shaded
                  band is the envelope. It currently does not propagate uncertainty in the
                  acetaldehyde or sleep outputs.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="border border-[var(--color-line)] p-3">
                    <div className="label">TBW standard deviation</div>
                    <div className="metric mt-1 text-[18px]">±7–9%</div>
                    <div className="micro mt-1">measured vs Watson estimate</div>
                  </div>
                  <div className="border border-[var(--color-line)] p-3">
                    <div className="label">Absorption spread</div>
                    <div className="metric mt-1 text-[18px]">0.82–1.20×</div>
                    <div className="micro mt-1">meal composition and emptying</div>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 border-l-2 border-[var(--color-accent)] pl-3 sm:max-w-[240px]">
                <Info size={14} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                <p className="micro">
                  A breathalyser reading does not retroactively change the model. It is stored
                  beside the curve so you can see the disagreement.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="What the model cannot know" subtitle="Read this before trusting any output" bodyClassName="panel-body">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Your exact pour", "ABV and volume are self-reported. A free-poured spirit can be 25–60% off."],
                ["Tolerance", "Chronic tolerance changes subjective impairment, not BAC or acetaldehyde exposure."],
                ["Menstrual cycle", "Cycle phase and oral contraceptives shift body water and ethanol kinetics. The model has only a coarse modifier."],
                ["Food composition", "Fat, protein, fibre and volume are collapsed into three inputs."],
                ["Liver function", "FIB-4 is a fibrosis proxy, not a measure of metabolic reserve. Normal enzymes do not exclude damage."],
                ["Drug interactions", "The medication list is not a complete interaction database and does not model CYP kinetics."],
                ["Sensor lag", "Transdermal ethanol and interstitial glucose lag blood concentrations."],
                ["Emergency medicine", "This cannot detect alcohol poisoning, hypoglycaemia or a mixed overdose."],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-2.5">
                  <WarningCircle size={13} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
                  <div>
                    <div className="text-[11px] text-ink">{title}</div>
                    <p className="micro mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Sources" subtitle="Primary literature behind the structure" bodyClassName="panel-body pt-1">
            {REFERENCES.map((ref) => (
              <div key={ref.id} className="row items-start">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
                <div className="min-w-0">
                  <div className="text-[11.5px] text-ink">{ref.title}</div>
                  <p className="micro mt-0.5">{ref.detail}</p>
                  <div className="mt-1 font-mono text-[9px] text-faint">{ref.source}</div>
                </div>
              </div>
            ))}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Model card" bodyClassName="panel-body">
            <div className="space-y-2">
              {[
                ["Version", "1.0.0"],
                ["Type", "Deterministic ODE"],
                ["Resolution", "2 min"],
                ["Projection", "12–72 h"],
                ["Distribution", "Total body water"],
                ["Clearance", "Michaelis–Menten"],
                ["Toxicity", "Acetaldehyde compartment"],
                ["Output", "Point + 90% band"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-[var(--color-line)] pb-1.5 last:border-0">
                  <span className="text-[11px] text-muted">{k}</span>
                  <span className="font-mono text-[10.5px] text-ink">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Safety frame" bodyClassName="panel-body">
            <p className="text-[12px] leading-relaxed text-muted">
              No level of alcohol consumption is proven safe. The Global Burden of Disease
              analysis found that the safest level is none. This app models relative risk; it
              does not license drinking.
            </p>
            <div className="mt-3 border-l-2 border-[var(--color-danger)] pl-3">
              <p className="micro">
                <span className="text-ink">Never use a BAC estimate to decide whether to drive.</span>{" "}
                Impairment begins below legal limits, and this model has no access to your
                measured coordination.
              </p>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <WarningCircle size={14} className="mt-0.5 shrink-0 text-[var(--color-warn)]" />
              <p className="micro">
                If someone cannot be woken, is breathing slowly, is vomiting repeatedly or has a
                seizure, call emergency services. Do not leave them to sleep it off.
              </p>
            </div>
          </Panel>

          <Panel title="Make it sharper" subtitle="The inputs that reduce uncertainty most" bodyClassName="panel-body">
            <div className="space-y-3">
              <Lever n="01" title="Measured body composition" body="A DEXA scan replaces a ±9% population estimate with a measured fat-free mass." href="#/baseline" cta="Open baseline" />
              <Lever n="02" title="A genotype test" body="ALDH2 status is the largest single modifier of acetaldehyde exposure." href="#/baseline" cta="Set genotype" />
              <Lever n="03" title="A PEth and liver panel" body="Turns the chronic view from self-report into measurement." href="#/labs" cta="Enter labs" />
            </div>
          </Panel>

          <div className="flex items-start gap-2 border border-[var(--color-line)] p-3.5">
            <Flask size={14} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
            <p className="micro">
              Built as an educational instrument. It does not provide diagnosis, treatment or
              fitness-to-drive advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Lever({ n, title, body, href, cta }: { n: string; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="border-b border-[var(--color-line)] pb-3 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] text-[var(--color-accent)]">{n}</span>
        <div className="text-[11.5px] text-ink">{title}</div>
      </div>
      <p className="micro mt-1">{body}</p>
      <a href={href} className="mt-1.5 inline-flex items-center gap-1 font-mono text-[9px] text-[var(--color-accent)] hover:underline">
        {cta} <ArrowRight size={9} />
      </a>
    </div>
  );
}
