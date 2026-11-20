import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";

const ROLE_LABEL: Record<string, { en: string; ur: string; icon: string }> = {
  PENSIONER: { en: "Pensioner", ur: "پنشنر", icon: "👵🏽" },
  HELPER: { en: "Helper", ur: "مددگار", icon: "🤝" },
  SHOPKEEPER: { en: "Shopkeeper", ur: "دکاندار", icon: "🏪" },
  OFFICER: { en: "Pension officer", ur: "پنشن افسر", icon: "🧑‍💼" },
  ADMIN: { en: "Admin", ur: "ایڈمن", icon: "⚙️" },
  AUDITOR: { en: "Auditor", ur: "آڈیٹر", icon: "🔍" },
};

export default function Header({ user, links = [] }: { user: SessionUser; links?: { href: string; label: string }[] }) {
  const role = ROLE_LABEL[user.role];
  return (
    <header className="card mb-5 flex flex-wrap items-center justify-between gap-3" style={{ padding: "12px 14px" }}>
      <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
        <Logo size={42} />
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold">Zinda Hon</span>
            <span className="ur text-base" style={{ lineHeight: 1.6 }}>زندہ ہوں</span>
          </div>
          <div className="muted text-xs flex items-center gap-1">
            <span>{role.icon}</span>
            <span>{user.name}</span>
            <span>·</span>
            <span>{role.en}</span>
          </div>
        </div>
      </Link>
      <nav className="flex flex-wrap gap-2 items-center">
        {links.map((l) => <Link key={l.href} href={l.href} className="btn btn-ghost btn-sm">{l.label}</Link>)}
        <LogoutButton />
      </nav>
    </header>
  );
}
