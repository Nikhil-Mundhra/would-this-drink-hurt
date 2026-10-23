import { useState, type ReactNode } from "react";
import {
  ChartLine,
  Gauge,
  Sliders,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useStore, useNow } from "../lib/store";
import { initials, formatTime } from "../lib/format";
import { ProfileDrawer } from "./ProfileDrawer";

export const ROUTES = [
  { id: "session", label: "Today's Session", icon: Gauge, key: "1" },
  { id: "history", label: "Long-Term Plan", icon: ChartLine, key: "2" },
] as const;

export type RouteId = "session" | "history" | "baseline" | "labs" | "method";

const ALL_ROUTES: RouteId[] = ["session", "history", "baseline", "labs", "method"];

export function currentRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ALL_ROUTES.includes(hash as RouteId) ? (hash as RouteId) : "session";
}

export function Shell({ route, children }: { route: RouteId; children: ReactNode }) {
  const { state, clearExampleData } = useStore();
  const now = useNow();
  const [profileOpen, setProfileOpen] = useState(false);
  const page = ROUTES.find((r) => r.id === route);
  const active = ALL_ROUTES.includes(route);

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        <a href="#/session" className="rail-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <span className="brand-word">WTDH</span>
            <span className="brand-sub">metabolic model</span>
          </span>
        </a>

        <nav className="rail-nav">
          <div className="rail-section">Navigation</div>
          {ROUTES.map((r) => {
            const Icon = r.icon;
            return (
              <a
                key={r.id}
                href={`#/${r.id}`}
                className="nav-item"
                data-active={r.id === route}
                aria-current={r.id === route ? "page" : undefined}
              >
                <Icon size={16} weight={r.id === route ? "fill" : "regular"} />
                {r.label}
                <span className="nav-key">{r.key}</span>
              </a>
            );
          })}
        </nav>

        <div className="rail-foot">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="rail-profile w-full text-left hover:bg-[rgba(255,255,255,0.03)] p-2 rounded-lg transition-all"
            title="Calibrate your body weight & sex"
          >
            <span className="avatar">{initials(state.profile.name || "User")}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-ink font-medium">
                {state.profile.weightKg || 75} kg · {state.profile.sex === "female" ? "Female" : "Male"}
              </div>
              <div className="micro text-[var(--color-accent)] flex items-center gap-1">
                <Sliders size={11} /> Body Specs
              </div>
            </div>
          </button>
          <p className="rail-note mt-2">
            Metabolic model. Does not clear you to drive.
          </p>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-crumb">
            WTDH <span className="px-1.5 text-faint">/</span> <b>{page?.label ?? "Today's Session"}</b>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="btn btn-sm flex items-center gap-1.5 text-[12px]"
            >
              <Sliders size={13} className="text-[var(--color-accent)]" />
              <span>{state.profile.weightKg || 75} kg · {state.profile.sex === "female" ? "F" : "M"}</span>
            </button>
            <span className="clock font-mono text-[12px] text-muted">{formatTime(now)}</span>
          </div>
        </header>

        {state.isDemo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--color-line)] bg-[rgba(240,180,85,0.05)] px-4 py-2 md:px-6">
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-warn)]">
              <Warning size={12} weight="fill" />
              Demo session active
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="btn btn-sm" onClick={clearExampleData}>
                <X size={11} /> Clear demo
              </button>
            </div>
          </div>
        )}

        <main className="workspace">
          <div key={route} className="reveal">
            {children}
          </div>
        </main>

        <nav className="mobile-nav" aria-label="Primary navigation">
          {ROUTES.map((r) => {
            const Icon = r.icon;
            return (
              <a key={r.id} href={`#/${r.id}`} data-active={r.id === route} aria-current={r.id === route ? "page" : undefined}>
                <Icon size={19} weight={r.id === route ? "fill" : "regular"} />
                {r.label}
              </a>
            );
          })}
        </nav>
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
      {!active && <span className="sr-only">Showing session</span>}
    </div>
  );
}
