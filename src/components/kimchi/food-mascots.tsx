import type { ReactNode } from "react";

interface Mascot {
  id: string;
  name: string;
  background: string;
  draw: () => ReactNode;
}

const INK = "#2b2b2b";

function Face({
  x = 32,
  y = 39,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="-6" cy="0" r="2.4" fill={INK} />
      <circle cx="6" cy="0" r="2.4" fill={INK} />
      <path
        d="M-4 5q4 3 8 0"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="-11" cy="3.5" r="2.3" fill="#f4a3a6" opacity="0.65" />
      <circle cx="11" cy="3.5" r="2.3" fill="#f4a3a6" opacity="0.65" />
    </g>
  );
}

function Kimchi() {
  return (
    <>
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
      <Face y={43} scale={0.9} />
    </>
  );
}

function Tteokbokki() {
  return (
    <>
      <path
        d="M10 32h44c-2 13-10 20-22 20S12 45 10 32z"
        fill="#fffdf9"
        stroke={INK}
        strokeWidth="2.5"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="22"
        ry="6"
        fill="#e5484d"
        stroke={INK}
        strokeWidth="2"
      />
      <rect
        x="19"
        y="26"
        width="9"
        height="9"
        rx="4.5"
        fill="#fff3e7"
        stroke={INK}
        strokeWidth="2"
      />
      <rect
        x="30"
        y="24"
        width="10"
        height="10"
        rx="5"
        fill="#fff3e7"
        stroke={INK}
        strokeWidth="2"
      />
      <rect
        x="41"
        y="27"
        width="8"
        height="8"
        rx="4"
        fill="#fff3e7"
        stroke={INK}
        strokeWidth="2"
      />
      <Face y={46} scale={0.88} />
    </>
  );
}

function Bibimbap() {
  return (
    <>
      <path
        d="M10 32h44c-2 13-10 20-22 20S12 45 10 32z"
        fill="#2b2b2b"
        stroke={INK}
        strokeWidth="2.5"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="22"
        ry="6"
        fill="#fffdf9"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="23" cy="31" r="5" fill="#7bb661" />
      <circle cx="36" cy="29" r="5" fill="#f08a5d" />
      <circle cx="43" cy="33" r="4" fill="#f2c94c" />
      <circle
        cx="31"
        cy="32"
        r="5.5"
        fill="#fffdf9"
        stroke={INK}
        strokeWidth="1.8"
      />
      <circle cx="31" cy="32" r="2.4" fill="#f2c94c" />
      <Face y={46} scale={0.86} />
    </>
  );
}

function Gimbap() {
  return (
    <>
      <rect
        x="18"
        y="12"
        width="28"
        height="40"
        rx="11"
        fill="#2f5d3a"
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect x="22" y="16" width="20" height="32" rx="8" fill="#fffdf9" />
      <circle cx="27" cy="24" r="3" fill="#f08a5d" />
      <circle cx="37" cy="24" r="3" fill="#f2c94c" />
      <circle cx="27" cy="34" r="3" fill="#7bb661" />
      <circle cx="37" cy="34" r="3" fill="#e5484d" />
      <Face y={43} scale={0.82} />
    </>
  );
}

function Ramyeon() {
  return (
    <>
      <path
        d="M12 28h40c-1 15-9 22-20 22S13 43 12 28z"
        fill="#e5484d"
        stroke={INK}
        strokeWidth="2.5"
      />
      <ellipse
        cx="32"
        cy="28"
        rx="20"
        ry="5.5"
        fill="#f2c94c"
        stroke={INK}
        strokeWidth="2"
      />
      <path
        d="M17 28c3-3 6 2 9-1s6 2 9-1 6 2 9-1"
        stroke="#fff3e7"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx="39"
        cy="25"
        r="5"
        fill="#fffdf9"
        stroke={INK}
        strokeWidth="1.8"
      />
      <circle cx="39" cy="25" r="2.2" fill="#f2c94c" />
      <Face y={44} scale={0.88} />
    </>
  );
}

function Mandu() {
  return (
    <>
      <path
        d="M13 39c0-13 8-21 19-21s19 8 19 21c0 7-8 11-19 11S13 46 13 39z"
        fill="#fffdf9"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path
        d="M19 27c4-3 8-4 13-4s9 1 13 4"
        stroke={INK}
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M23 24v-5M32 22v-6M41 24v-5"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Face y={41} scale={0.9} />
    </>
  );
}

function Hotteok() {
  return (
    <>
      <ellipse
        cx="32"
        cy="35"
        rx="22"
        ry="16"
        fill="#d99a4e"
        stroke={INK}
        strokeWidth="2.5"
      />
      <ellipse cx="32" cy="35" rx="12" ry="8" fill="#8b5a2b" opacity="0.85" />
      <circle cx="19" cy="27" r="2" fill="#f2c94c" />
      <circle cx="45" cy="42" r="2" fill="#f2c94c" />
      <Face y={40} scale={0.82} />
    </>
  );
}

function Bungeoppang() {
  return (
    <>
      <path
        d="M13 35c0-9 8-15 20-15s20 6 20 15-8 15-20 15-20-6-20-15z"
        fill="#f2c94c"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path d="M13 35l-7-7v14z" fill="#f08a5d" stroke={INK} strokeWidth="2" />
      <path
        d="M28 25l4 7-4 7"
        stroke={INK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Face x={34} y={38} scale={0.78} />
    </>
  );
}

function Samgyeopsal() {
  return (
    <>
      <rect
        x="11"
        y="22"
        width="42"
        height="24"
        rx="11"
        fill="#f08a9a"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path
        d="M16 28h32M16 40h32"
        stroke="#fffdf9"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      <Face y={36} scale={0.82} />
    </>
  );
}

function Japchae() {
  return (
    <>
      <path
        d="M10 32h44c-2 13-10 20-22 20S12 45 10 32z"
        fill="#fffdf9"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path
        d="M15 30c4-6 8 2 12-4s8 2 12-4 8 2 10-1"
        stroke="#b8865b"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="21" cy="33" r="3" fill="#7bb661" />
      <circle cx="43" cy="33" r="3" fill="#f08a5d" />
      <circle cx="32" cy="31" r="2.5" fill="#f2c94c" />
      <Face y={46} scale={0.86} />
    </>
  );
}

function Odeng() {
  return (
    <>
      <path
        d="M20 9v46"
        stroke="#b8865b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M16 21c0-4 3-6 6-6h22c3 0 5 2 5 5s-2 5-5 5H22c-3 0-6-1-6-4z"
        fill="#f2c94c"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path
        d="M20 35c0-4 3-6 6-6h18c3 0 5 2 5 5s-2 5-5 5H26c-3 0-6-1-6-4z"
        fill="#f2c94c"
        stroke={INK}
        strokeWidth="2.5"
      />
      <Face x={34} y={29} scale={0.74} />
    </>
  );
}

function Soju() {
  return (
    <>
      <rect
        x="24"
        y="9"
        width="16"
        height="9"
        rx="3"
        fill="#4f8a3d"
        stroke={INK}
        strokeWidth="2"
      />
      <path
        d="M22 18h20l-2 31c0 4-3 6-8 6s-8-2-8-6z"
        fill="#7bb661"
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect x="26" y="34" width="12" height="12" rx="3" fill="#fffdf9" />
      <Face y={41} scale={0.7} />
    </>
  );
}

const MASCOTS: Mascot[] = [
  { id: "kimchi", name: "Kimchi jar", background: "#ffe3d3", draw: Kimchi },
  {
    id: "tteokbokki",
    name: "Tteokbokki",
    background: "#ffe1d6",
    draw: Tteokbokki,
  },
  { id: "bibimbap", name: "Bibimbap", background: "#fff2cc", draw: Bibimbap },
  { id: "gimbap", name: "Gimbap", background: "#e7f3e0", draw: Gimbap },
  { id: "ramyeon", name: "Ramyeon", background: "#ffe0d6", draw: Ramyeon },
  { id: "mandu", name: "Mandu", background: "#fff4e6", draw: Mandu },
  { id: "hotteok", name: "Hotteok", background: "#ffe9c7", draw: Hotteok },
  {
    id: "bungeoppang",
    name: "Bungeoppang",
    background: "#e0f0ff",
    draw: Bungeoppang,
  },
  {
    id: "samgyeopsal",
    name: "Samgyeopsal",
    background: "#ffe6e6",
    draw: Samgyeopsal,
  },
  { id: "japchae", name: "Japchae", background: "#f3e8ff", draw: Japchae },
  { id: "odeng", name: "Odeng", background: "#e6f7ff", draw: Odeng },
  { id: "soju", name: "Soju", background: "#e6f7e9", draw: Soju },
];

/** Stable non-cryptographic hash so a pubkey always maps to the same mascot. */
export function mascotHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The mascot assigned to a pubkey or other stable seed. */
export function mascotIndex(seed: string): number {
  return mascotHash(seed) % MASCOTS.length;
}

/** Human-readable mascot name for a seed. */
export function mascotName(seed: string): string {
  return MASCOTS[mascotIndex(seed)].name;
}

/** A deterministic Korean-food avatar used when no profile picture is set. */
export function FoodMascot({
  seed,
  size = 32,
  className,
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const index = mascotIndex(seed);
  const mascot = MASCOTS[index];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${mascot.name} avatar`}
    >
      <circle cx="32" cy="32" r="32" fill={mascot.background} />
      {mascot.draw()}
    </svg>
  );
}
