"use client";
import { useEffect } from "react";

// Shown when a page crashes. The crash is reported to the admin's System health card, and the person
// gets a simple way back. Their saved proof-of-life steps stay on the phone.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: `Page crashed: ${error.message}${error.digest ? ` (${error.digest})` : ""}`.slice(0, 2000), stack: error.stack?.slice(0, 8000), page: location.pathname }), keepalive: true }).catch(() => undefined);
  }, [error]);
  return (
    <div className="card max-w-xl mx-auto text-center space-y-3 mt-8" role="alert">
      <div className="text-6xl">⚠️</div>
      <p className="ur text-2xl">کچھ غلط ہو گیا۔ آپ کا کام محفوظ ہے۔</p>
      <p>Something went wrong. Your saved steps are safe on this phone.</p>
      <div className="flex gap-2 justify-center">
        <button className="btn" onClick={reset}>🔁 Try again</button>
        <a className="btn btn-ghost" href="/">🏠 Home</a>
      </div>
    </div>
  );
}
