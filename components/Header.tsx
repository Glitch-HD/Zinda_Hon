import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";
import Info from "./ui/Info";
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
  return (
    <header className="card mb-6 flex flex-wrap items-center justify-between gap-3" style={{ padding: "12px 16px" }}>
      <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }} data-say="ہوم" data-say-en="Home">
        <Logo size={44} />
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-xl brand-word">Zinda Hon</span>
            <span className="ur always text-base" style={{ lineHeight: 1.6 }}>زندہ ہوں</span>
          </div>
          <div className="muted text-xs flex flex-wrap items-center gap-1">
            <span>{role.icon}</span>
            <span>{user.name}</span>
            <span>·</span>
            <span className="en">{role.en}</span>
            <span className="ur" style={{ lineHeight: 1.6 }}>{role.ur}</span>
          </div>
        </div>
      </Link>
      <nav className="flex flex-wrap gap-2 items-center">
        {links.map((l) => (
          <span key={l.href} className="inline-flex items-center gap-1">
            <Link href={l.href} className="btn btn-ghost btn-sm" data-say={l.info?.ur ?? l.ur} data-say-en={l.info?.en ?? (typeof l.label === "string" ? l.label : undefined)}>
              <span className={l.ur ? "en" : ""}>{l.label}</span>
              {l.ur && <span className="ur">{l.ur}</span>}
            </Link>
            {l.info && <Info en={l.info.en} ur={l.info.ur} />}
          </span>
        ))}
        <LogoutButton />
      </nav>
      <SessionGuard userId={user.id} userName={user.name} />
      <RoleSync role={user.role} />
    </header>
  );
}
