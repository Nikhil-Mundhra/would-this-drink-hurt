import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import {
  LEGAL_LIMITS,
  REFERENCES,
  computeAllostatic,
  computeHeadroom,
  estimatePeth,
  interpretLabs,
  makeDemoHistory,
  makeDemoProfile,
  makeDemoSession,
  simulate,
  standardDrinks,
} from "@wtdh/engine";
import { headroomSchema, historySchema, simulateSchema } from "./schemas.js";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "wtdh-metabolic-api",
    version: "1.0.0",
    time: new Date().toISOString(),
  }),
);

app.get("/api/reference", (c) =>
  c.json({
    legalLimits: LEGAL_LIMITS,
    standardDrinkGrams: { us: 14, who: 10 },
    references: REFERENCES,
    disclaimer:
      "Educational model, not a medical device. It cannot determine fitness to drive, and no alcohol dose is risk-free.",
  }),
);

app.post("/api/simulate", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = simulateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }
  const { profile, session, at, horizonHours, stepMinutes } = parsed.data;
  const result = simulate({
    profile,
    session,
    at: at ?? Date.now(),
    horizonHours,
    stepMinutes,
  });
  return c.json(
    {
      summary: result.summary,
      preSession: result.preSession,
      samples: result.samples,
      standardDrinks: standardDrinks(result.summary.totalEthanolG),
    },
    200,
    { "Cache-Control": "no-store" },
  );
});

app.post("/api/headroom", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = headroomSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }
  return c.json(computeHeadroom(parsed.data.profile, parsed.data.consumedG, parsed.data.at ?? Date.now()));
});

app.post("/api/labs", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = historySchema.safeParse({
    ...(body ?? {}),
    history: (body as { history?: unknown })?.history ?? [],
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }
  const at = parsed.data.at ?? Date.now();
  return c.json({
    panel: interpretLabs(parsed.data.profile),
    peth: estimatePeth(parsed.data.history, at),
    allostatic: computeAllostatic(parsed.data.profile, parsed.data.history, at),
  });
});

app.post("/api/allostatic", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = historySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }
  return c.json(computeAllostatic(parsed.data.profile, parsed.data.history, parsed.data.at ?? Date.now()));
});

app.get("/api/demo", (c) => {
  const now = Date.now();
  return c.json({
    profile: makeDemoProfile(),
    session: makeDemoSession(now),
    history: makeDemoHistory(now),
    generatedAt: now,
    label: "Example data",
  });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
