"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Instant feedback: the moment a link or a button that talks to the server is pressed, a thin bar
// runs along the top of the screen until the next page (or the server's answer) arrives.
// The bar only appears if the wait is longer than a blink, so fast actions do not flicker.
const QUIET = /\/api\/(auth\/me|voice\/|client-error)/;

export default function NavProgress() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const nav = useRef(false);
  const inflight = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = () => {
    const busy = nav.current || inflight.current > 0;
    if (busy && !timer.current) {
      timer.current = setTimeout(() => setOn(true), 120);
      if (safety.current) clearTimeout(safety.current);
      safety.current = setTimeout(() => { nav.current = false; inflight.current = 0; update(); }, 15000);
    }
    if (!busy) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setOn(false);
    }
  };

  // A new page has arrived: the navigation is over.
  useEffect(() => { nav.current = false; update(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname) return; // same page, new filter: the page itself updates
      nav.current = true;
      update();
    }
    const realFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const track = method !== "GET" && !QUIET.test(url);
      if (track) { inflight.current++; update(); }
      try { return await realFetch(input, init); }
      finally { if (track) { inflight.current = Math.max(0, inflight.current - 1); update(); } }
    };
    const leaving = () => { nav.current = true; update(); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", leaving);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("beforeunload", leaving); window.fetch = realFetch; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className={`nav-progress${on ? " on" : ""}`} aria-hidden="true" />;
}
