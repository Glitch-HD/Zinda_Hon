"use client";
import { useEffect } from "react";

// Sends crashes on the person's phone to /api/client-error so the admin sees them. At most 5 reports
// per page load, the same message only once, and never while offline.
export default function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const send = (message: string, stack?: string) => {
      if (!navigator.onLine || seen.size >= 5 || seen.has(message)) return;
      seen.add(message);
      const body = JSON.stringify({ message: message.slice(0, 2000), stack: stack?.slice(0, 8000), page: location.pathname });
      fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    };
    const onError = (e: ErrorEvent) => send(e.message || "Script error", e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : String(r ?? "Unhandled rejection"), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
