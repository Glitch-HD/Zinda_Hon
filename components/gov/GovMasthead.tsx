import Link from "next/link";
import GovSeal from "./GovSeal";
import Icon from "@/components/ui/Icon";

// Government-portal masthead: white band with the seal and service name, then a green menu bar.
// Our own prototype service; it does not claim to be any real department.
const MENU = [
  { href: "/", en: "Home", ur: "ہوم" },
  { href: "/login#services", en: "Services", ur: "خدمات" },
  { href: "/login#how", en: "How it works", ur: "طریقہ" },
  { href: "/check-message", en: "Check a message", ur: "پیغام جانچیں" },
  { href: "/ask", en: "Pension rules", ur: "قواعد" },
  { href: "/docs", en: "API for banks", ur: "اے پی آئی" },
];

export default function GovMasthead() {
  return (
    <header className="gov-mast" data-no-voice>
      <div className="gov-mast-inner">
        <Link href="/" className="gov-brand" aria-label="Zinda Hon home">
          <GovSeal size={62} />
          <span className="gov-brand-text">
            <span className="gov-kicker">Pension Proof-of-Life Service · <span className="ur always" style={{ lineHeight: 1.5 }}>ثبوتِ حیات سروس</span></span>
            <span className="gov-name">Zinda Hon <span className="ur always">زندہ ہوں</span></span>
            <span className="gov-sub">Simulated Pension Department · Prototype for Coder&apos;s Cup &apos;26</span>
          </span>
        </Link>
        <div className="gov-help">
          <span className="gov-help-ic" aria-hidden><Icon name="phone" size={20} /></span>
          <span className="leading-tight">
            <span className="gov-help-l">Helpline (mock)</span>
            <b className="gov-help-n">0300-0000000</b>
          </span>
        </div>
      </div>
      <nav className="gov-menu" aria-label="Main menu">
        <div className="gov-menu-inner">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="gov-menu-link">
              <span className="en">{m.en}</span><span className="ur">{m.ur}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
