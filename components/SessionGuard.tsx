"use client";
import { useEffect, useRef, useState } from "react";

// 1. Logs the person out after 10 minutes without any tap, key or scroll (warning shown 1 minute before).
//    While they are active, the session is renewed in the background.
// 2. All tabs of one browser share one login. If someone logs in as a different person in another tab,
//    this tab says so instead of silently showing the other person's page.
const IDLE_MS = 10 * 60_000;
const WARN_MS = 9 * 60_000;
const RENEW_EVERY_MS = 60_000;

export default function SessionGuard({ userId, userName }: { userId: string; userName: string }) {
  const lastActive = useRef(Date.now());
  const lastRenew = useRef(Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [other, setOther] = useState<{ name: string } | null>(null);

  useEffect(() => {
    async function logout() {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      window.location.href = "/login?expired=1";
    }
    function active() {
      lastActive.current = Date.now();
      setSecondsLeft(null);
      if (Date.now() - lastRenew.current > RENEW_EVERY_MS) {
        lastRenew.current = Date.now();
        void fetch("/api/auth/refresh", { method: "POST" }).then((r) => { if (r.status === 401) void check(); }).catch(() => undefined);
      }
    }
    async function check() {
      try {
        const me = await (await fetch("/api/auth/me", { cache: "no-store" })).json();
        if (!me.id) { window.location.href = "/login?expired=1"; return; }
        if (me.id !== userId) setOther({ name: me.name });
      } catch { /* offline: keep the page as it is */ }
    }
    const tick = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= IDLE_MS) void logout();
      else if (idle >= WARN_MS) setSecondsLeft(Math.ceil((IDLE_MS - idle) / 1000));
    }, 1000);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    const onFocus = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, active));
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);

  if (other) {
    return (
      <div className="overlay" role="alertdialog" aria-modal="true">
        <div className="card space-y-3 max-w-md text-center" style={{ padding: 24 }}>
          <div className="text-5xl"></div>
          <h2 className="text-xl font-bold">You logged in as someone else in another window</h2>
          <p className="muted">This window was for <b>{userName}</b>, but this browser is now logged in as <b>{other.name}</b>. One browser can only be logged in as one person at a time.</p>
          <p className="text-sm">To test two people side by side, open the second one in a <b>private / incognito window</b> or a different browser.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => (window.location.href = "/")}>Continue as {other.name.split(" ")[0]}</button>
            <button className="btn" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>Log in again</button>
          </div>
        </div>
      </div>
    );
  }
  if (secondsLeft !== null) {
    return (
      <div className="overlay" role="alertdialog" aria-modal="true">
        <div className="card space-y-3 max-w-sm text-center" style={{ padding: 24 }}>
          <div className="text-5xl"></div>
          <p className="ur text-xl">آپ {secondsLeft} سیکنڈ میں لاگ آؤٹ ہو جائیں گے</p>
          <p className="en font-semibold">For your safety you will be logged out in {secondsLeft} seconds.</p>
          <button className="btn btn-big" onClick={() => { lastActive.current = 0; lastRenew.current = 0; lastActive.current = Date.now(); setSecondsLeft(null); void fetch("/api/auth/refresh", { method: "POST" }); }}>
            <span className="text-3xl"></span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">میں یہیں ہوں</span><span className="en text-sm font-semibold opacity-90">I&apos;m still here</span></span>
          </button>
        </div>
      </div>
    );
  }
  return null;
}
