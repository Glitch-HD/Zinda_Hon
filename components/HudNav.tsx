"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Info from "./ui/Info";
import type { HeaderLink } from "./Header";

// The header's page links, with the current page highlighted.
export default function HudNav({ links }: { links: HeaderLink[] }) {
  const path = usePathname();
  const active = links.reduce<string | null>((best, l) => (path === l.href || path.startsWith(l.href + "/")) && (!best || l.href.length > best.length) ? l.href : best, null);
  return (
    <>
      {links.map((l) => (
        <span key={l.href} className="inline-flex items-center gap-1">
          <Link href={l.href} className={`hud-link ${active === l.href ? "on" : ""}`} aria-current={active === l.href ? "page" : undefined} data-say={l.info?.ur ?? l.ur} data-say-en={l.info?.en ?? l.label}>
            <span className={l.ur ? "en" : ""}>{l.label}</span>
            {l.ur && <span className="ur">{l.ur}</span>}
          </Link>
          {l.info && <Info en={l.info.en} ur={l.info.ur} />}
        </span>
      ))}
    </>
  );
}
