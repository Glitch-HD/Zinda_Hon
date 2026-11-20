import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  PENSIONER: "Pensioner · پنشنر",
  HELPER: "Helper · مددگار",
  SHOPKEEPER: "Shopkeeper · دکاندار",
  OFFICER: "Pension officer · پنشن افسر",
  ADMIN: "Admin · ایڈمن",
  AUDITOR: "Auditor · آڈیٹر",
};

export default function Header({ user, links = [] }: { user: SessionUser; links?: { href: string; label: string }[] }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div>
        <Link href="/" className="text-xl font-bold">🫀 Zinda Hon</Link>
        <div className="muted text-sm">{user.name} · {ROLE_LABEL[user.role]}</div>
      </div>
      <nav className="flex flex-wrap gap-2 items-center">
        {links.map((l) => <Link key={l.href} href={l.href} className="btn btn-ghost">{l.label}</Link>)}
        <LogoutButton />
      </nav>
    </header>
  );
}
