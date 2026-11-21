// An illustrated Karachi dusk: a domed white monument with pointed arches, minarets, palms, a crescent
// moon and the city behind. Drawn in SVG (no photos), so it is light on a weak connection and works offline.
export default function HeroScene() {
  const stars = [[120, 70], [260, 140], [380, 60], [520, 110], [700, 50], [930, 90], [1080, 40], [1180, 130], [1330, 80], [1460, 150], [1540, 60], [60, 200], [860, 160]];
  const city = [[0, 470, 70], [70, 430, 50], [120, 500, 60], [180, 455, 40], [220, 410, 55], [275, 480, 50], [325, 445, 45], [1220, 450, 60], [1280, 405, 45], [1325, 470, 55], [1380, 430, 50], [1430, 490, 70], [1500, 440, 45], [1545, 470, 55]];
  const arches = [-120, -60, 0, 60, 120];
  return (
    <svg className="hero-scene" viewBox="0 0 1600 720" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a2f33" />
          <stop offset=".38" stopColor="#2b3470" />
          <stop offset=".66" stopColor="#9b4a6e" />
          <stop offset=".86" stopColor="#e9895a" />
          <stop offset="1" stopColor="#f6c27a" />
        </linearGradient>
        <radialGradient id="hs-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd89a" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffd89a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hs-marble" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9cfe0" />
          <stop offset=".55" stopColor="#fbf1e6" />
          <stop offset="1" stopColor="#c7b8d2" />
        </linearGradient>
        <linearGradient id="hs-dome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfc3d9" />
          <stop offset=".5" stopColor="#fff7ee" />
          <stop offset="1" stopColor="#b9a8c8" />
        </linearGradient>
        <linearGradient id="hs-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2a3a" />
          <stop offset="1" stopColor="#0b1418" />
        </linearGradient>
      </defs>
      <rect width="1600" height="720" fill="url(#hs-sky)" />
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.4 : 2.2} fill="#fff" opacity={i % 2 ? .7 : .45} />)}
      {/* crescent moon */}
      <mask id="hs-moon"><circle cx="740" cy="108" r="26" fill="#fff" /><circle cx="751" cy="102" r="23" fill="#000" /></mask>
      <circle cx="740" cy="108" r="26" fill="#fde9b8" mask="url(#hs-moon)" />
      <circle cx="740" cy="108" r="60" fill="#fde9b8" opacity=".08" />
      <circle cx="800" cy="520" r="360" fill="url(#hs-glow)" />
      {/* city behind */}
      <g fill="#3a2b52" opacity=".75">{city.map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={720 - y} />)}</g>
      <g fill="#ffcf85" opacity=".55">{city.map(([x, y, w], i) => <rect key={i} x={x + w / 3} y={y + 22} width="6" height="8" />)}</g>
      {/* minarets */}
      {[560, 1040].map((x) => (
        <g key={x}>
          <rect x={x - 9} y="300" width="18" height="300" fill="url(#hs-marble)" />
          <rect x={x - 15} y="372" width="30" height="7" fill="#efe3d6" />
          <rect x={x - 15} y="452" width="30" height="7" fill="#efe3d6" />
          <path d={`M${x - 12} 300 Q${x} 262 ${x + 12} 300 Z`} fill="url(#hs-dome)" />
          <rect x={x - 1} y="248" width="2" height="18" fill="#f3d38a" />
        </g>
      ))}
      {/* monument: base with pointed arches, drum and dome */}
      <g>
        <rect x="620" y="430" width="360" height="180" fill="url(#hs-marble)" />
        <rect x="610" y="418" width="380" height="16" fill="#f4ebe1" />
        {arches.map((dx) => (
          <path key={dx} d={`M${800 + dx - 20} 600 V505 Q${800 + dx - 20} 470 ${800 + dx} 458 Q${800 + dx + 20} 470 ${800 + dx + 20} 505 V600 Z`} fill="#3c2a4d" />
        ))}
        {arches.map((dx) => (
          <path key={`l${dx}`} d={`M${800 + dx - 12} 600 V512 Q${800 + dx - 12} 488 ${800 + dx} 478 Q${800 + dx + 12} 488 ${800 + dx + 12} 512 V600 Z`} fill="#f2a65a" opacity=".85" />
        ))}
        <rect x="690" y="372" width="220" height="50" fill="url(#hs-marble)" />
        <path d="M690 374 C 690 250, 760 205, 800 186 C 840 205, 910 250, 910 374 Z" fill="url(#hs-dome)" />
        <path d="M800 186 V150" stroke="#f3d38a" strokeWidth="4" />
        <circle cx="800" cy="146" r="6" fill="#f3d38a" />
      </g>
      {/* palms */}
      {[[420, 1], [1190, -1], [300, 1], [1310, -1]].map(([x, s], i) => (
        <g key={i} transform={`translate(${x} ${i > 1 ? 470 : 430}) scale(${s * (i > 1 ? .8 : 1)} ${i > 1 ? .8 : 1})`} fill="#0f1d22">
          <path d="M-4 0 Q 6 90 -2 200 H 8 Q 16 90 4 0 Z" />
          <path d="M0 0 Q-60 -20 -110 20 Q-55 -5 0 6 Z" /><path d="M0 0 Q 55 -30 115 10 Q 55 -8 0 6 Z" />
          <path d="M0 0 Q-35 -55 -80 -60 Q-30 -40 0 4 Z" /><path d="M0 0 Q 30 -60 85 -55 Q 35 -35 0 4 Z" />
          <path d="M0 0 Q-10 -60 5 -90 Q 5 -50 3 2 Z" />
        </g>
      ))}
      {/* ground, steps and a still pool */}
      <rect x="0" y="600" width="1600" height="120" fill="url(#hs-ground)" />
      <rect x="560" y="600" width="480" height="10" fill="#2c3b4e" />
      <rect x="520" y="612" width="560" height="10" fill="#243244" />
      <rect x="690" y="640" width="220" height="60" rx="4" fill="#f2a65a" opacity=".18" />
    </svg>
  );
}
