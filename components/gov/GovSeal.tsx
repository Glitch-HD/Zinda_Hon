// Round seal for the government-portal look. Our own mark (heartbeat in a laurel ring), not any real emblem.
export default function GovSeal({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#0b3a75" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#3d9bff" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="21" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => {
        const a = (200 + i * 20) * (Math.PI / 180);
        const b = (-20 - i * 20) * (Math.PI / 180);
        return (
          <g key={i} fill="#3d9bff">
            <ellipse cx={32 + 24 * Math.cos(a)} cy={32 - 24 * Math.sin(a)} rx="1.4" ry="3" transform={`rotate(${-((200 + i * 20) - 90)} ${32 + 24 * Math.cos(a)} ${32 - 24 * Math.sin(a)})`} />
            <ellipse cx={32 + 24 * Math.cos(b)} cy={32 - 24 * Math.sin(b)} rx="1.4" ry="3" transform={`rotate(${-((-20 - i * 20) - 90)} ${32 + 24 * Math.cos(b)} ${32 - 24 * Math.sin(b)})`} />
          </g>
        );
      })}
      <path d="M17 34h7l3-7 5 13 4-9 2 3h9" fill="none" stroke="#0b3a75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
