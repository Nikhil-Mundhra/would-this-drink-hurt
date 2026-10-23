import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider } from "./lib/store";
import { Shell, currentRoute, type RouteId } from "./components/Shell";
import { SessionPage } from "./pages/Session";
import { HistoryPage } from "./pages/History";
import { BaselinePage } from "./pages/Baseline";
import { LabsPage } from "./pages/Labs";
import { MethodPage } from "./pages/Method";

const TITLES: Record<string, string> = {
  session: "Today's Session",
  history: "Long-Term Plan",
  baseline: "Baseline Calibration",
  labs: "Clinical Labs",
  method: "Pharmacokinetic Method",
};

function useHashRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

function Instrument() {
  const route = useHashRoute();

  useEffect(() => {
    document.title = `WTDH · ${TITLES[route] ?? "Session"} · Metabolic alcohol model`;
  }, [route]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const map: Record<string, RouteId> = {
        "1": "session",
        "2": "history",
      };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        window.location.hash = `#/${next}`;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Shell route={route}>
      {route === "history" && <HistoryPage />}
      {route === "baseline" && <BaselinePage />}
      {route === "labs" && <LabsPage />}
      {route === "method" && <MethodPage />}
      {route === "session" && <SessionPage />}
    </Shell>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("WTDH instrument error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center p-6">
          <div className="panel max-w-[460px] p-6">
            <div className="label">Instrument fault</div>
            <h1 className="display mt-3 text-[28px]">The model stopped mid-calculation.</h1>
            <p className="prose-b mt-3 text-[12px]">
              Your entries are still in local storage. Reload to rebuild the curve. If the fault
              returns, reset the session from the session page; no data leaves this browser.
            </p>
            <pre className="mt-4 overflow-x-auto border border-[var(--color-line)] p-3 font-mono text-[10px] text-[var(--color-danger)]">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  window.localStorage.removeItem("wtdh.state.v1");
                  window.location.reload();
                }}
              >
                Reset local data
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <Boundary>
      <StoreProvider>
        <Instrument />
      </StoreProvider>
    </Boundary>
  );
}
