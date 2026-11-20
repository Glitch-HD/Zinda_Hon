"use client";
import Link from "next/link";
import Info from "./Info";

// One big choice on screen: picture, Urdu, English, a one-line hint, and an ⓘ that explains it.
// `say` is what the voice guide reads out when the option is tapped.
type Props = {
  icon: string;
  ur: string;
  en: string;
  hintEn?: string;
  hintUr?: string;
  info: { en: string; ur: string };
  say?: string;
  href?: string;
  onClick?: () => void;
  variant?: "hero" | "normal" | "compact";
  disabled?: boolean;
};

export default function Option({ icon, ur, en, hintEn, hintUr, info, say, href, onClick, variant = "normal", disabled }: Props) {
  const cls = `tile ${variant === "hero" ? "tile-hero" : ""} ${variant === "compact" ? "tile-compact" : ""} ${variant === "normal" ? "tile-col" : ""}`;
  const body = (
    <>
      <span className="tile-icon">{icon}</span>
      <span className="tile-text">
        <span className="ur block tile-ur">{ur}</span>
        <span className="en block tile-en">{en}</span>
        {(hintEn || hintUr) && (
          <span className="block tile-hint">
            {hintUr && <span className="ur block">{hintUr}</span>}
            {hintEn && <span className="en block">{hintEn}</span>}
          </span>
        )}
      </span>
      {variant === "compact" && <span className="muted" aria-hidden="true">→</span>}
    </>
  );
  return (
    <div className="tile-wrap">
      {href ? (
        <Link href={href} className={cls} data-say={say ?? info.ur} aria-disabled={disabled}>{body}</Link>
      ) : (
        <button type="button" className={cls} data-say={say ?? info.ur} onClick={onClick} disabled={disabled}>{body}</button>
      )}
      <span className="tile-info"><Info en={info.en} ur={info.ur} /></span>
    </div>
  );
}
