import { useMemo } from "react";
import { simulate } from "@wtdh/engine";
import { useStore } from "./store";

export function useSimulation(atOverride?: number) {
  const { state, now } = useStore();
  const at = atOverride ?? now;

  return useMemo(() => {
    const started = state.session.startedAt;
    const horizon = Math.min(72, Math.max(12, (at - started) / 3_600_000 + 4));
    return simulate({
      profile: state.profile,
      session: state.session,
      at,
      horizonHours: horizon,
      stepMinutes: 2,
    });
  }, [state.profile, state.session, at]);
}
