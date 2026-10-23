import type { ReactNode } from "react";
import {
  ChartLine,
  Flask,
  Gauge,
  BookOpenText,
  User,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useStore, useNow } from "../lib/store";
import { initials, formatTime } from "../lib/format";

export const ROUTES = [
  { id: "session", label: "Session", icon: Gauge, key: "1" },
  { id: "baseline", label: "Baseline", icon: User, key: "2" },
  { id: "labs", label: "Labs", icon: Flask, key: "3" },
  { id: "history", label: "History", icon: ChartLine, key: "4" },
  { id: "method", label: "Method", icon: BookOpenText, key: "5" },
] as const;

export type RouteId = (typeof ROUTES)[number]["id"];

export function currentRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const found = ROUTES.find((r) => r.id === hash);
  return found ? found.id : "session";
}

export function Shell({ route, children }: { route: RouteId; children: ReactNode }) {
  const { state, clearExampleData } = useStore();
  const now = useNow();
  const page = ROUTES.find((r) => r.id === route);
  const active = ROUTES.map((r) => r.id).includes(route);

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
          <div className="rail-section">Instrument</div>
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
          <div className="rail-profile">
            <span className="avatar">{initials(state.profile.name || "Your profile")}</span>
            <div className="min-w-0">
              <div className="truncate text-[12px] text-ink">{state.profile.name || "Your profile"}</div>
              <div className="micro">{state.profile.age} y · {state.profile.sex === "male" ? "male" : "female"}</div>
            </div>
          </div>
          <p className="rail-note">
            A model, not a medical device. It cannot clear you to drive.
          </p>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-crumb">
            WTDH <span className="px-1.5 text-faint">/</span> <b>{page?.label ?? "Session"}</b>
          </div>
          <div className="topbar-right">
            <span className="badge hidden sm:inline-flex">
              <span className="dot dot-live" />
              model v1.0
            </span>
            <span className="clock">{formatTime(now)}</span>
          </div>
        </header>

        {state.isDemo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--color-line)] bg-[rgba(240,180,85,0.05)] px-4 py-2 md:px-6">
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-warn)]">
              <Warning size={12} weight="fill" />
              Example profile, session and labs
            </span>
            <span className="micro">
              Nothing here describes you until you replace it.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <a href="#/baseline" className="btn btn-sm">
                Edit baseline
              </a>
              <button type="button" className="btn btn-sm" onClick={clearExampleData}>
                <X size={11} /> Clear example
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
      {!active && <span className="sr-only">Unknown page, showing session</span>}
    </div>
  );
}
