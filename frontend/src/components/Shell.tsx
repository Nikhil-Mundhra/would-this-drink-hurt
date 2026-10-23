import { useState, type ReactNode } from "react";
import {
  ChartLine,
  Gauge,
  List,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const page = ROUTES.find((r) => r.id === route);
  const active = ALL_ROUTES.includes(route);

  return (
    <div className="app-shell">
      {/* Desktop Sidebar Rail */}
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

      {/* Main Content Area */}
      <div className="main-col">
        {/* Topbar with Mobile Hamburger Button */}
        <header className="topbar">
          <div className="flex items-center gap-2">
            {/* Hamburger Button (Visible on mobile/tablet) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-muted hover:text-ink focus:outline-none rounded-md border border-[var(--color-line)] active:scale-95 transition-transform"
              aria-label="Open navigation menu"
            >
              <List size={18} weight="bold" />
            </button>

            <div className="topbar-crumb flex items-center gap-1.5">
              <span className="font-semibold text-ink">WTDH</span>
              <span className="text-faint">/</span>
              <span className="font-medium text-ink">{page?.label ?? "Today's Session"}</span>
            </div>
          </div>

          <div className="topbar-right flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="btn btn-sm flex items-center gap-1.5 text-[11px] sm:text-[12px] py-1 px-2.5"
            >
              <Sliders size={13} className="text-[var(--color-accent)]" />
              <span>{state.profile.weightKg || 75} kg · {state.profile.sex === "female" ? "F" : "M"}</span>
            </button>
            <span className="clock font-mono text-[11px] sm:text-[12px] text-muted">{formatTime(now)}</span>
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
      </div>

      {/* MOBILE HAMBURGER SLIDE-OVER DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer container */}
          <div className="fixed inset-y-0 left-0 max-w-[280px] w-full bg-[#0a0f0d] border-r border-[var(--color-line)] p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200 z-10">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)]">
                <div className="flex items-center gap-2.5">
                  <span className="brand-mark" aria-hidden="true" />
                  <div>
                    <div className="font-semibold text-ink text-[15px] leading-tight tracking-tight">WTDH</div>
                    <div className="text-[10px] text-muted">metabolic model</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-muted hover:text-ink rounded-md hover:bg-[rgba(255,255,255,0.05)]"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="mt-6 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-2.5 px-1">
                  Main Views
                </div>
                {ROUTES.map((r) => {
                  const Icon = r.icon;
                  const isActive = r.id === route;
                  return (
                    <a
                      key={r.id}
                      href={`#/${r.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-lg text-[14px] transition-all ${
                        isActive
                          ? "bg-[rgba(195,242,90,0.12)] text-[var(--color-accent)] border border-[rgba(195,242,90,0.3)] font-semibold"
                          : "text-muted hover:text-ink hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                      }`}
                    >
                      <Icon size={19} weight={isActive ? "fill" : "regular"} />
                      <span>{r.label}</span>
                    </a>
                  );
                })}
              </div>

              {/* Body Specs Calibration Shortcut */}
              <div className="mt-7 pt-5 border-t border-[var(--color-line)]">
                <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-2 px-1">
                  Body Calibration
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setProfileOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] text-left hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  <div>
                    <div className="text-[13px] font-medium text-ink">
                      {state.profile.weightKg || 75} kg · {state.profile.sex === "female" ? "Female" : "Male"}
                    </div>
                    <div className="text-[11px] text-[var(--color-accent)] flex items-center gap-1 mt-0.5">
                      <Sliders size={12} /> Edit weight &amp; sex
                    </div>
                  </div>
                </button>
              </div>

              {/* Advanced Clinical Modules */}
              <div className="mt-6">
                <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-2 px-1">
                  Advanced Modules
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <a
                    href="#/baseline"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded border border-[var(--color-line)] text-muted hover:text-ink bg-[rgba(255,255,255,0.01)]"
                  >
                    Genetics
                  </a>
                  <a
                    href="#/labs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded border border-[var(--color-line)] text-muted hover:text-ink bg-[rgba(255,255,255,0.01)]"
                  >
                    Labs
                  </a>
                  <a
                    href="#/method"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded border border-[var(--color-line)] text-muted hover:text-ink bg-[rgba(255,255,255,0.01)]"
                  >
                    Math
                  </a>
                </div>
              </div>
            </div>

            {/* Disclaimer Footer */}
            <div className="pt-4 border-t border-[var(--color-line)] text-[10.5px] text-faint leading-tight">
              Metabolic model. Does not clear you to operate vehicles.
            </div>
          </div>
        </div>
      )}

      {/* Profile/Body Specs Drawer */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
      {!active && <span className="sr-only">Showing session</span>}
    </div>
  );
}
