"use client";
import { useEffect, useRef, useState } from "react";
import { flush, pendingCount } from "@/lib/client/queue";
import { speakUrdu } from "@/lib/client/voice";
import { voiceOn } from "@/lib/client/prefs";

// Weak internet, made visible. On every page: a clear banner while the phone is offline (with how many
// steps are saved and waiting), and a short "sent" message once the signal is back and they have gone.
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState(0);
  const [sent, setSent] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => { setOnline(navigator.onLine); setWaiting(pendingCount()); };
    async function back() {
      check();
      if (!navigator.onLine || pendingCount() === 0) return;
      const r = await flush().catch(() => null);
      setWaiting(pendingCount());
      if (r && r.sent > 0) {
        setSent(r.sent);
        if (voiceOn()) void speakUrdu("انٹرنیٹ واپس آ گیا۔ آپ کے محفوظ قدم بھیج دیے گئے۔", "The internet is back. Your saved steps have been sent.");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setSent(0), 6000);
      }
    }
    function gone() {
      check();
      if (voiceOn()) void speakUrdu("انٹرنیٹ نہیں ہے۔ فکر نہ کریں، آپ کا کام فون میں محفوظ ہے اور بعد میں خود بھیج دیا جائے گا۔", "No internet. Don't worry, your work is saved on the phone and will be sent later by itself.");
    }
    check();
    void back();
    window.addEventListener("online", back);
    window.addEventListener("offline", gone);
    const poll = setInterval(check, 2000);
    return () => { window.removeEventListener("online", back); window.removeEventListener("offline", gone); clearInterval(poll); if (timer.current) clearTimeout(timer.current); };
  }, []);

  if (!online) return (
    <div className="net-banner net-off" role="status" data-no-voice>
      <b><span className="en">Offline</span> <span className="ur">انٹرنیٹ نہیں</span></b>
      <span><span className="en">Your work is saved on this phone and will be sent by itself when the signal returns.</span> <span className="ur">آپ کا کام محفوظ ہے، سگنل آنے پر خود بھیج دیا جائے گا۔</span></span>
      {waiting > 0 && <span className="badge badge-warn">{waiting} <span className="en">waiting</span> <span className="ur">باقی</span></span>}
    </div>
  );
  if (sent > 0) return (
    <div className="net-banner net-ok" role="status" data-no-voice>
      <b><span className="en">Back online</span> <span className="ur">انٹرنیٹ واپس</span></b>
      <span><span className="en">{sent} saved step(s) sent.</span> <span className="ur">محفوظ قدم بھیج دیے گئے۔</span></span>
    </div>
  );
  if (waiting > 0) return (
    <div className="net-banner net-wait" role="status" data-no-voice>
      <span><span className="en">{waiting} saved step(s) waiting to send. They will go as soon as the signal is good.</span> <span className="ur">کچھ قدم بھیجنے باقی ہیں۔</span></span>
    </div>
  );
  return null;
}
