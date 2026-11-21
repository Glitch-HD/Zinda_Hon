// Simple line icons (24×24, stroke) used instead of emojis. Data in the app still names icons with an
// emoji (for example icon: "🛡️"); this maps that to a clean icon, and shows nothing for anything else.
const P: Record<string, string[]> = {
  mic: ["M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z", "M5 10v1a7 7 0 0 0 14 0v-1", "M12 18v4", "M8 22h8"],
  stop: ["M7 7h10v10H7z"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  users: ["M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M2 21a7 7 0 0 1 14 0", "M16 4.1a4 4 0 0 1 0 7.8", "M22 21a7 7 0 0 0-5-6.7"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  question: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  play: ["M7 4l13 8-13 8z"],
  camera: ["M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  book: ["M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2z", "M4 20a2 2 0 0 0 2 2h14v-4"],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"],
  check: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M8 12l3 3 5-6"],
  building: ["M3 21h18", "M5 21V10", "M19 21V10", "M3 10l9-6 9 6", "M9 21v-6h6v6"],
  store: ["M3 9l2-5h14l2 5", "M4 9v12h16V9", "M3 9h18", "M9 21v-6h6v6"],
  scale: ["M12 3v18", "M7 21h10", "M4 7h16", "M7 7l-3 7a3 3 0 0 0 6 0z", "M17 7l-3 7a3 3 0 0 0 6 0z"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h6"],
  alert: ["M12 3l10 18H2z", "M12 10v4", "M12 18h.01"],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "M4.9 4.9L7 7", "M17 17l2.1 2.1", "M4.9 19.1L7 17", "M17 7l2.1-2.1"],
  id: ["M3 5h18v14H3z", "M8 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M14 10h4", "M14 14h3"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M21 21l-4.3-4.3"],
  speaker: ["M11 5L6 9H2v6h4l5 4z", "M15.5 8.5a5 5 0 0 1 0 7", "M19 5a10 10 0 0 1 0 14"],
  face: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"],
  wifi: ["M2 9a15 15 0 0 1 20 0", "M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", "M12 20h.01"],
  chart: ["M3 3v18h18", "M8 17v-6", "M13 17V7", "M18 17v-4"],
  home: ["M3 11l9-8 9 8", "M5 10v11h14V10", "M10 21v-6h4v6"],
  phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"],
  doc: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
};

const FROM_EMOJI: Record<string, keyof typeof P> = {
  "🎤": "mic", "🎙": "mic", "⏹": "stop", "⏳": "clock", "🕘": "clock", "🗓": "clock",
  "🧑‍💼": "user", "👤": "user", "🧓": "user", "👵": "user", "👴": "user",
  "👥": "users", "🤝": "users",
  "🛡": "shield", "❓": "question", "🔐": "lock", "🔑": "lock", "▶": "play", "📷": "camera",
  "📖": "book", "📘": "book", "📜": "file", "📨": "send", "✅": "check", "✔": "check",
  "🏛": "building", "🏦": "building", "🏪": "store", "⚖": "scale", "📝": "doc", "📋": "file",
  "⚠": "alert", "🚨": "alert", "⛔": "alert", "🩺": "heart", "📐": "settings", "⚙": "settings", "🔧": "settings",
  "🪪": "id", "🔎": "search", "🔍": "search", "🕵": "search", "🔊": "speaker", "🙂": "face", "📶": "wifi",
  "📊": "chart", "🗺": "chart", "🏠": "home", "☎": "phone", "📱": "phone",
};

function key(emoji: string) {
  // Drop variation selectors and skin tones so "👵🏽" and "🛡️" find their entry.
  return emoji.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, "");
}

export type IconName = keyof typeof P;

export default function Icon({ e, name, size = 24, className }: { e?: string; name?: IconName; size?: number; className?: string }) {
  const n = name ?? (e ? FROM_EMOJI[key(e)] : undefined);
  if (!n) return null;
  return (
    <svg className={`ico ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[n].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
