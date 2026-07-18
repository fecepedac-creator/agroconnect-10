type TelemetryKind = "client_error" | "performance";

type TelemetryPayload = {
  kind: TelemetryKind;
  name: string;
  value?: number;
  route: string;
  release: string;
  timestamp: string;
  context?: Record<string, string | number | boolean>;
};

const endpoint = String(import.meta.env.VITE_TELEMETRY_ENDPOINT || "").trim();
const release = String(import.meta.env.VITE_RELEASE_SHA || "local").slice(0, 64);

function emit(payload: TelemetryPayload): void {
  if (import.meta.env.DEV) {
    console.info("[telemetry]", payload);
  }

  if (!endpoint || typeof navigator === "undefined" || !navigator.sendBeacon) return;
  navigator.sendBeacon(endpoint, new Blob([JSON.stringify(payload)], {type: "application/json"}));
}

function basePayload(kind: TelemetryKind, name: string): TelemetryPayload {
  return {
    kind,
    name: name.slice(0, 120),
    route: window.location.pathname.slice(0, 160),
    release,
    timestamp: new Date().toISOString(),
  };
}

export function reportClientError(error: unknown, context: Record<string, string> = {}): void {
  const normalized = error instanceof Error ? error : new Error(String(error || "Unknown error"));
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code).slice(0, 80)
    : "unknown";
  emit({
    ...basePayload("client_error", normalized.name || "Error"),
    context: {
      ...context,
      errorCode: code,
    },
  });
}

export function startClientObservability(): () => void {
  const onError = (event: ErrorEvent) => reportClientError(event.error || event.message, {source: "window"});
  const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason, {source: "promise"});
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const observers: PerformanceObserver[] = [];
  if ("PerformanceObserver" in window) {
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (navigation) {
        emit({...basePayload("performance", "page_load_ms"), value: Math.round(navigation.loadEventEnd - navigation.startTime)});
      }

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const entry = entries[entries.length - 1];
        if (entry) emit({...basePayload("performance", "lcp_ms"), value: Math.round(entry.startTime)});
      });
      lcpObserver.observe({type: "largest-contentful-paint", buffered: true});
      observers.push(lcpObserver);
    } catch {
      // Older browsers may expose PerformanceObserver without supporting LCP.
    }
  }

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    observers.forEach((observer) => observer.disconnect());
  };
}
