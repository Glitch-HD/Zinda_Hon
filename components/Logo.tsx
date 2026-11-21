// The Zinda Hon mark: a heartbeat line inside a soft leaf shape. Pure SVG, no image download.
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="zh-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#628a43" />
          <stop offset="1" stopColor="#4b6b34" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#zh-g)" />
      <path d="M9 26h7l3-7 5 14 4-10 2 3h9" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="38" cy="12" r="4" fill="#f0ad43" />
    </svg>
  );
}
