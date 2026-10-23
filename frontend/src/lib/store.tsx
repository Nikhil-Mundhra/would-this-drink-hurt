import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DailyLog, Drink, Meal, Profile, SensorSample, Session } from "@wtdh/engine";
import { makeDemoHistory, makeDemoProfile, makeDemoSession } from "@wtdh/engine";

const STORAGE_KEY = "wtdh.state.v1";

export interface AppState {
  profile: Profile;
  session: Session;
  history: DailyLog[];
  isDemo: boolean;
  onboarded: boolean;
}

export function defaultProfile(): Profile {
  return {
    name: "",
    age: 30,
    sex: "male",
    heightCm: 178,
    weightKg: 75,
    bodyFatPct: null,
    genetics: { adh1b: "unknown", adh1c: "unknown", aldh2: "unknown" },
    conditions: { liver: "none", diabetes: "none", hypertension: false, pregnancy: false },
    medications: [],
    baseline: {
      restingHr: 60,
      hrvMs: 50,
      sleepHours: 7,
      hydrationPct: 55,
      stress: 3,
      weeklyExerciseMinutes: 120,
    },
    labs: null,
  };
}

export function emptySession(now = Date.now()): Session {
  return { startedAt: now, drinks: [], meals: [], waters: [], sensors: [], readings: [] };
}

function initialState(): AppState {
  return {
    profile: defaultProfile(),
    session: emptySession(),
    history: [],
    isDemo: false,
    onboarded: true,
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed.profile || !parsed.session) return initialState();
    return {
      ...initialState(),
      ...parsed,
      profile: { ...defaultProfile(), ...parsed.profile },
      session: { ...emptySession(), ...parsed.session },
      history: Array.isArray(parsed.history) ? parsed.history : [],
      isDemo: Boolean(parsed.isDemo),
      onboarded: parsed.onboarded !== undefined ? Boolean(parsed.onboarded) : true,
    };
  } catch {
    return initialState();
  }
}

interface StoreValue {
  state: AppState;
  now: number;
  setProfile: (profile: Profile) => void;
  updateProfile: (updater: (p: Profile) => Profile) => void;
  updateSession: (updater: (s: Session) => Session) => void;
  addDrink: (drink: Omit<Drink, "id" | "at">, at?: number) => void;
  removeDrink: (id: string) => void;
  addWater: (volumeMl: number, at?: number) => void;
  removeWater: (id: string) => void;
  clearWater: () => void;
  addMeal: (meal: Omit<Meal, "id" | "at">, at?: number) => void;
  removeMeal: (id: string) => void;
  addSensor: (sample: Omit<SensorSample, "at">) => void;
  addReading: (bac: number, source: string) => void;
  resetSession: () => void;
  setHistory: (history: DailyLog[]) => void;
  upsertDay: (day: DailyLog) => void;
  removeDay: (date: string) => void;
  completeOnboarding: (profile: Profile, useExample: boolean) => void;
  loadExample: () => void;
  clearExampleData: () => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    timer.current = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private mode. The app still works in memory.
    }
  }, [state]);

  const updateSession = useCallback((updater: (s: Session) => Session) => {
    setState((prev) => ({ ...prev, session: updater(prev.session) }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      now,
      setProfile: (profile) => setState((prev) => ({ ...prev, profile })),
      updateProfile: (updater) =>
        setState((prev) => ({ ...prev, profile: updater(prev.profile) })),
      updateSession,
      addDrink: (drink, timestamp) =>
        updateSession((s) => {
          const at = timestamp ?? Date.now();
          const entry: Drink = { ...drink, id: crypto.randomUUID(), at };
          const allDrinks = [...s.drinks, entry].sort((a, b) => a.at - b.at);
          return {
            ...s,
            startedAt: allDrinks.length > 0 ? Math.min(s.startedAt, allDrinks[0].at) : at,
            drinks: allDrinks,
          };
        }),
      removeDrink: (id) =>
        updateSession((s) => ({ ...s, drinks: s.drinks.filter((d) => d.id !== id) })),
      addWater: (volumeMl, timestamp) =>
        updateSession((s) => ({
          ...s,
          waters: [
            ...s.waters,
            { id: crypto.randomUUID(), at: timestamp ?? Date.now(), volumeMl },
          ].sort((a, b) => a.at - b.at),
        })),
      removeWater: (id) =>
        updateSession((s) => ({ ...s, waters: s.waters.filter((w) => w.id !== id) })),
      clearWater: () =>
        updateSession((s) => ({ ...s, waters: [] })),
      addMeal: (meal, timestamp) =>
        updateSession((s) => ({
          ...s,
          meals: [
            ...s.meals,
            { ...meal, id: crypto.randomUUID(), at: timestamp ?? Date.now() },
          ].sort((a, b) => a.at - b.at),
        })),
      removeMeal: (id) =>
        updateSession((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) })),
      addSensor: (sample) =>
        updateSession((s) => ({
          ...s,
          sensors: [...s.sensors, { ...sample, at: Date.now() }],
        })),
      addReading: (bac, source) =>
        updateSession((s) => ({
          ...s,
          readings: [...s.readings, { at: Date.now(), bac, source }],
        })),
      resetSession: () =>
        setState((prev) => ({ ...prev, session: emptySession(Date.now()) })),
      setHistory: (history) => setState((prev) => ({ ...prev, history })),
      upsertDay: (day) =>
        setState((prev) => ({
          ...prev,
          history: [...prev.history.filter((d) => d.date !== day.date), day].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),
      removeDay: (date) =>
        setState((prev) => ({ ...prev, history: prev.history.filter((d) => d.date !== date) })),
      completeOnboarding: (profile, useExample) => {
        if (useExample) {
          const now = Date.now();
          setState({
            profile: makeDemoProfile(),
            session: makeDemoSession(now),
            history: makeDemoHistory(now),
            isDemo: true,
            onboarded: true,
          });
          return;
        }
        setState((prev) => ({
          ...prev,
          profile: profile.name.trim() ? profile : { ...profile, name: "Your profile" },
          session: emptySession(Date.now()),
          history: [],
          isDemo: false,
          onboarded: true,
        }));
      },
      loadExample: () => {
        const now = Date.now();
        setState({
          profile: makeDemoProfile(),
          session: makeDemoSession(now),
          history: makeDemoHistory(now),
          isDemo: true,
          onboarded: true,
        });
      },
      clearExampleData: () =>
        setState((prev) => ({
          ...prev,
          profile: { ...prev.profile, labs: null },
          session: emptySession(),
          history: [],
          isDemo: false,
        })),
      resetAll: () => setState(initialState()),
    }),
    [state, now, updateSession],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useNow(): number {
  return useStore().now;
}
