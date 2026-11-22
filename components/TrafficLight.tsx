import SayButton from "@/components/ui/SayButton";

// A traffic light for people who cannot read: red = stopped, amber = something to do or waiting,
// green = all done. The lit colour, an icon shape and a spoken sentence all say the same thing.
export type Light = "red" | "amber" | "green";
export function lightFor(status?: string | null): Light {
  if (status === "VERIFIED") return "green";
  if (status === "STOPPED") return "red";
  return "amber";
}
const WORD: Record<Light, { en: string; ur: string }> = {
  green: { en: "Green: all is well", ur: "سبز: سب ٹھیک ہے" },
  amber: { en: "Amber: something is still to do", ur: "پیلا: کچھ باقی ہے" },
  red: { en: "Red: pension stopped", ur: "لال: پنشن رکی ہوئی ہے" },
};

export default function TrafficLight({ status, ur, en, children }: { status?: string | null; ur: string; en: string; children?: React.ReactNode }) {
  const l = lightFor(status);
  return (
    <div className={`traffic t-${l}`} data-say={`${WORD[l].ur}۔ ${ur}`}>
      <div className="traffic-lights" aria-hidden="true">
        <i className={`l-red ${l === "red" ? "on" : ""}`} />
        <i className={`l-amber ${l === "amber" ? "on" : ""}`} />
        <i className={`l-green ${l === "green" ? "on" : ""}`} />
      </div>
      <div className="traffic-body">
        <span className={`traffic-sm t-${l}`}><span className="en">{WORD[l].en.split(":")[0]}</span><span className="both-only"> · </span><span className="ur">{WORD[l].ur.split(":")[0]}</span></span>
        <b className="ur" style={{ whiteSpace: "normal", lineHeight: 1.9 }}>{ur}</b>
        <span className="en">{en}</span>
        {children}
      </div>
      <SayButton ur={`${WORD[l].ur}۔ ${ur}`} en={`${WORD[l].en}. ${en}`} />
    </div>
  );
}

/** Small version for lists (helper cards, officer tables). */
export function TrafficDot({ status }: { status?: string | null }) {
  const l = lightFor(status);
  return <span className={`traffic-sm t-${l}`} title={WORD[l].en}><span className="en">{WORD[l].en.split(":")[0]}</span><span className="ur">{WORD[l].ur.split(":")[0]}</span></span>;
}
