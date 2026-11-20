"use client";
import { useState } from "react";
export default function ReviewButtons({ id, current }: { id: string; current: string | null }) {
  const [label, setLabel] = useState(current);
  async function set(l: "scam" | "genuine") {
    const res = await fetch(`/api/messages/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: l }) });
    if (res.ok) setLabel(l);
  }
  return (
    <div className="flex gap-1">
      <button className={`btn ${label === "scam" ? "" : "btn-ghost"}`} onClick={() => set("scam")}>Scam</button>
      <button className={`btn ${label === "genuine" ? "" : "btn-ghost"}`} onClick={() => set("genuine")}>Genuine</button>
    </div>
  );
}
