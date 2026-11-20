import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";
import Info from "./ui/Info";

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
      <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }} data-say="ہوم">
        <Logo size={44} />
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold">Zinda Hon</span>
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
            <Link href={l.href} className="btn btn-ghost btn-sm" data-say={l.info?.ur ?? l.ur}>
              <span className={l.ur ? "en" : ""}>{l.label}</span>
              {l.ur && <span className="ur">{l.ur}</span>}
            </Link>
            {l.info && <Info en={l.info.en} ur={l.info.ur} />}
          </span>
        ))}
        <LogoutButton />
      </nav>
    </header>
  );
}
