import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";
import HudNav from "./HudNav";
import SessionGuard from "./SessionGuard";
import RoleSync from "./RoleSync";

const ROLE_LABEL: Record<string, { en: string; ur: string; icon: string }> = {
  PENSIONER: { en: "Pensioner", ur: "پنشنر", icon: "👵🏽" },
  HELPER: { en: "Helper", ur: "مددگار", icon: "🤝" },
  SHOPKEEPER: { en: "Shopkeeper", ur: "دکاندار", icon: "🏪" },
  OFFICER: { en: "Pension officer", ur: "پنشن افسر", icon: "🧑‍💼" },
  ADMIN: { en: "Admin", ur: "ایڈمن", icon: "⚙️" },
  AUDITOR: { en: "Auditor", ur: "آڈیٹر", icon: "🔍" },
};

export type HeaderLink = { href: string; label: string; ur?: string; info?: { en: string; ur: string } };

export default function Header({ user, links = [] }: { user: SessionUser; links?: HeaderLink[] }) {
  const role = ROLE_LABEL[user.role];
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <header className={`hud mb-6 hud-${user.role.toLowerCase()}`}>
      <div className="hud-row">
        <Link href="/" className="hud-brand" data-say="ہوم" data-say-en="Home">
          <Logo size={40} />
          <span className="leading-tight">
            <span className="flex items-baseline gap-2"><span className="text-lg brand-word">Zinda Hon</span><span className="ur always" style={{ lineHeight: 1.6 }}>زندہ ہوں</span></span>
            <span className="hud-tag"><span className="live-dot" /> <span className="en">Proof of life, made simple</span><span className="ur">زندگی کا ثبوت، آسانی سے</span></span>
          </span>
        </Link>
        <div className="hud-user">
          <span className="hud-avatar" aria-hidden>{initials}</span>
          <span className="leading-tight min-w-0">
            <b className="block truncate">{user.name}</b>
            <span className="hud-role"><span className="en">{role.en}</span><span className="ur">{role.ur}</span></span>
          </span>
          <LogoutButton />
        </div>
      </div>
      {links.length > 0 && <nav className="hud-nav" aria-label="Pages"><HudNav links={links} /></nav>}
      <SessionGuard userId={user.id} userName={user.name} />
      <RoleSync role={user.role} />
    </header>
  );
}
