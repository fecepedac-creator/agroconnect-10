import {error, info, warn} from "firebase-functions/logger";

type Outcome = "success" | "failure" | "degraded";

type OperationalEvent = {
  functionName: string;
  action: string;
  outcome: Outcome;
  errorCode?: string;
  durationMs?: number;
  requestId?: string;
  context?: Record<string, string | number | boolean | null>;
};

export function logOperationalEvent(event: OperationalEvent): void {
  const payload = {
    schemaVersion: 1,
    function: event.functionName,
    action: event.action,
    outcome: event.outcome,
    errorCode: event.errorCode || null,
    durationMs: event.durationMs ?? null,
    requestId: event.requestId || null,
    ...event.context,
  };

  if (event.outcome === "failure") {
    error("operational_event", payload);
    return;
  }
  if (event.outcome === "degraded") {
    warn("operational_event", payload);
    return;
  }
  info("operational_event", payload);
}
