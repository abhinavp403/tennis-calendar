export default function AppLogo({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Tennis Calendar logo"
    >
      <defs>
        <radialGradient id="al-ball" cx="38%" cy="30%" r="68%">
          <stop offset="0%" stopColor="#f2ff55" />
          <stop offset="48%" stopColor="#ccdd00" />
          <stop offset="100%" stopColor="#7a9200" />
        </radialGradient>
        <linearGradient id="al-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#141428" />
          <stop offset="100%" stopColor="#0a0a18" />
        </linearGradient>
        <radialGradient id="al-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c8dd00" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#c8dd00" stopOpacity="0" />
        </radialGradient>
        <clipPath id="al-ballClip">
          <circle cx="24" cy="24" r="18" />
        </clipPath>
      </defs>

      {/* Background rounded square */}
      <rect width="48" height="48" rx="11" fill="url(#al-bg)" />
      <rect width="48" height="48" rx="11" fill="none" stroke="#1e2040" strokeWidth="1" />

      {/* Soft glow behind ball */}
      <circle cx="24" cy="24" r="22" fill="url(#al-glow)" />

      {/* Tennis ball */}
      <circle cx="24" cy="24" r="18" fill="url(#al-ball)" />

      {/* Calendar grid lines clipped to ball */}
      <g clipPath="url(#al-ballClip)" opacity="0.16">
        <line x1="6"  y1="29" x2="42" y2="29" stroke="#1a2800" strokeWidth="1.1" />
        <line x1="6"  y1="35" x2="42" y2="35" stroke="#1a2800" strokeWidth="1.1" />
        <line x1="19" y1="26" x2="19" y2="42" stroke="#1a2800" strokeWidth="1.1" />
        <line x1="25" y1="26" x2="25" y2="42" stroke="#1a2800" strokeWidth="1.1" />
        <line x1="31" y1="26" x2="31" y2="42" stroke="#1a2800" strokeWidth="1.1" />
      </g>

      {/* Left seam */}
      <path
        d="M 11 8 C 22 17, 22 31, 11 40"
        stroke="white" strokeWidth="2.8" fill="none"
        strokeLinecap="round" opacity="0.88"
        clipPath="url(#al-ballClip)"
      />

      {/* Right seam */}
      <path
        d="M 37 8 C 26 17, 26 31, 37 40"
        stroke="white" strokeWidth="2.8" fill="none"
        strokeLinecap="round" opacity="0.88"
        clipPath="url(#al-ballClip)"
      />

      {/* Highlight shimmer */}
      <ellipse cx="19" cy="17" rx="7" ry="4.5"
        fill="white" opacity="0.14"
        transform="rotate(-25 19 17)"
      />

      {/* Calendar badge (bottom-right) */}
      <rect x="28" y="30" width="16" height="14" rx="3.5"
        fill="#0d0d1a" stroke="#2a3060" strokeWidth="1" />
      <rect x="28" y="30" width="16" height="4.5" rx="3.5" fill="#0044aa" />
      <rect x="28" y="32" width="16" height="2.5" fill="#0044aa" />
      <circle cx="33" cy="40" r="1.4" fill="white" opacity="0.5" />
      <circle cx="36" cy="40" r="1.6" fill="#a78bfa" />
      <circle cx="39" cy="40" r="1.4" fill="white" opacity="0.5" />
    </svg>
  );
}
