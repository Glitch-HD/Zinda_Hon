"use client";
import Link from "next/link";
import { speakUrdu } from "@/lib/client/voice";
import type { AreaWarning as W } from "@/lib/area-warning";

const urNum = (n: number) => n.toLocaleString("ur-PK");

// Shows (and reads out in Urdu) the scam trick going round in this person's area this week.
export default function AreaWarning({ w }: { w: W }) {
  const sayUr = `خبردار۔ اس ہفتے ${w.area} میں ${urNum(w.count)} دھوکے کے پیغام آئے ہیں۔ ${w.trickUr}۔ ${w.adviceUr}`;
  const sayEn = `Warning. ${w.count} scam messages were reported in ${w.area} this week. ${w.trickEn}. ${w.adviceEn}`;
  return (
    <div className="card space-y-2" role="region" aria-label="Scam warning for your area" style={{ borderInlineStart: "5px solid var(--danger)" }}>
      <p className="font-semibold">🚨 <span className="en">Scam warning for {w.area}: {w.count} reported this week</span></p>
      <p className="ur text-xl" dir="rtl" lang="ur" style={{ display: "block" }}>اس ہفتے {w.area} میں {urNum(w.count)} دھوکے کے پیغام: {w.trickUr}</p>
      <p className="text-sm"><b>{w.trickEn}.</b> {w.adviceEn}</p>
      <p className="ur" dir="rtl" lang="ur" style={{ display: "block" }}>{w.adviceUr}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost btn-sm" data-no-voice onClick={() => speakUrdu(sayUr, sayEn)}>🔊 <span className="ur">سنیں</span> <span className="en">Listen</span></button>
        <Link className="btn btn-ghost btn-sm" href="/check-message">🛡️ <span className="en">Check a message</span> <span className="ur">پیغام جانچیں</span></Link>
      </div>
    </div>
  );
}
