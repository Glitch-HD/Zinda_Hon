"use client";
// Offline-first sync (Challenge 07 + Offline-First Sync bonus).
// Every step is saved on the phone first, with a unique id made on the phone. When the connection
// works, queued steps are sent in order. The server ignores an id it has already seen, so a step
// sent twice on a flaky connection is never stored twice.

export type QueuedAction = { id: string; url: string; body: unknown; createdAt: number };
const KEY = "zh_outbox_v1";

function read(): QueuedAction[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function write(items: QueuedAction[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or blocked: still try to send directly */ }
}

export function newActionId() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
}

export function pendingCount() { return read().length; }

export async function enqueue(url: string, body: Record<string, unknown>) {
  const id = String(body.clientActionId ?? newActionId());
  const items = read();
  items.push({ id, url, body: { ...body, clientActionId: id }, createdAt: Date.now() });
  write(items);
  return flush();
}

let flushing: Promise<{ sent: number; left: number; lastResult?: unknown }> | null = null;

export function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    let lastResult: unknown;
    while (true) {
      const items = read();
      if (items.length === 0 || !navigator.onLine) break;
      const next = items[0];
      try {
        const res = await fetch(next.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next.body) });
        lastResult = await res.json().catch(() => null);
        // 4xx = the server will never accept it (bad input, no permission): drop it so the queue doesn't jam.
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
          write(read().filter((i) => i.id !== next.id));
          sent++;
          if (!res.ok) break;
        } else break; // 5xx or 429: keep it and retry later
      } catch {
        break; // offline or connection dropped: keep it
      }
    }
    return { sent, left: read().length, lastResult };
  })().finally(() => { flushing = null; });
  return flushing;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flush(); });
}
