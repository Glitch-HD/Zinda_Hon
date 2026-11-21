import Icon from "@/components/ui/Icon";
import type { ReactNode } from "react";

// Small building blocks shared by the staff dashboards (officer, admin, auditor).

export const initials = (name: string) => name.replace(/\(.*?\)/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function greeting(now = new Date()) {
  const h = (now.getUTCHours() + 5) % 24; // Pakistan time
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function PageTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-title">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {right}
    </div>
  );
}

export function Stat({ n, label, icon, tone }: { n: ReactNode; label: ReactNode; icon?: string; tone?: "warn" | "danger" | "ok" }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ""}`}>
      {icon && <span className="stat-i" aria-hidden><Icon e={typeof icon === "string" ? icon : undefined} size={22} /></span>}
      <div className="stat-n">{n}</div>
      <div className="stat-l">{label}</div>
    </div>
  );
}

export function SectionHead({ title, count, sub, id }: { title: ReactNode; count?: number; sub?: ReactNode; id?: string }) {
  return (
    <div className="section-head" id={id}>
      <h2>{title}{count !== undefined && <span className="count">{count}</span>}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}
