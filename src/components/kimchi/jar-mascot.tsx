export function JarMascot({ full }: { full: boolean }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={full ? "kimchi-jar is-full" : "kimchi-jar"}
    >
      <rect x="16" y="10" width="32" height="8" rx="3" fill="#e5484d" />
      <rect
        x="12"
        y="18"
        width="40"
        height="38"
        rx="10"
        fill="#fffdf9"
        stroke="#e5484d"
        strokeWidth="3"
      />
      <rect x="18" y="24" width="28" height="26" rx="7" fill="#fff1e6" />
      <circle cx="25" cy="38" r="2.4" fill="#2b2b2b" />
      <circle cx="39" cy="38" r="2.4" fill="#2b2b2b" />
      <circle cx="21" cy="43" r="2.6" fill="#f2c94c" opacity="0.8" />
      <circle cx="43" cy="43" r="2.6" fill="#f2c94c" opacity="0.8" />
      <path
        d="M28 45c2.5 2 5.5 2 8 0"
        stroke="#2b2b2b"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <text
        x="32"
        y="34"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="#e5484d"
      >
        김치
      </text>
      {full && (
        <g className="kimchi-steam">
          <path
            d="M24 8c-2-3 2-5 0-8"
            stroke="#7bb661"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M32 8c-2-3 2-5 0-8"
            stroke="#7bb661"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M40 8c-2-3 2-5 0-8"
            stroke="#7bb661"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
