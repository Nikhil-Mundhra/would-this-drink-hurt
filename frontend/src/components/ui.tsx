import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClassName = "panel-body",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <header className="panel-head">
          <div className="min-w-0">
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

export function NumberInput({
  label,
  unit,
  help,
  value,
  onChange,
  min,
  max,
  step,
  className = "",
}: {
  label: string;
  unit?: string;
  help?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      <span className={unit ? "field-unit" : undefined}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step ?? "any"}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? "" : Number(raw));
          }}
        />
        {unit && <em>{unit}</em>}
      </span>
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

export function TextInput({
  label,
  help,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      <input className="input" {...rest} />
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

export function SelectInput({
  label,
  help,
  children,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; help?: string; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      <select className="select" {...rest}>
        {children}
      </select>
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`seg ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-on={o.value === value}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "safe" | "warn" | "danger";
}) {
  const cls =
    tone === "accent"
      ? "badge-accent"
      : tone === "safe"
        ? "badge-safe"
        : tone === "warn"
          ? "badge-warn"
          : tone === "danger"
            ? "badge-danger"
            : "";
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-7">
      {icon && <div className="text-[var(--color-faint)]">{icon}</div>}
      <div>
        <h3 className="text-[14px] font-medium text-ink">{title}</h3>
        <p className="prose-b mt-1 max-w-[46ch] text-[12px]">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="metric mt-1.5 text-[20px] leading-none text-ink">{value}</div>
      {sub && <div className="micro mt-1.5">{sub}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-left"
      aria-pressed={checked}
    >
      <span
        className="relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border transition-colors"
        style={{
          borderColor: checked ? "rgba(195,242,90,0.5)" : "var(--color-line-strong)",
          background: checked ? "rgba(195,242,90,0.16)" : "transparent",
        }}
      >
        <span
          className="block h-[10px] w-[10px] rounded-full transition-transform"
          style={{
            background: checked ? "var(--color-accent)" : "var(--color-faint)",
            transform: `translateX(${checked ? 17 : 3}px)`,
          }}
        />
      </span>
      <span className="text-[12px] text-muted">{label}</span>
    </button>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`hair ${className}`} />;
}
