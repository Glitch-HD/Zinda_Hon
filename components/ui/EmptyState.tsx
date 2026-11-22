import Icon, { type IconName } from "./Icon";

// One friendly look for "nothing here yet": an icon, a short line in English and Urdu, and an optional hint.
export default function EmptyState({ icon = "check", en, ur, hint }: { icon?: IconName; en: string; ur?: string; hint?: string }) {
  return (
    <div className="empty-state" role="status" data-say={ur ?? en}>
      <Icon name={icon} size={36} />
      <b><span className="en">{en}</span>{ur && <> <span className="ur" style={{ lineHeight: 1.8 }}>{ur}</span></>}</b>
      {hint && <span className="text-sm">{hint}</span>}
    </div>
  );
}
