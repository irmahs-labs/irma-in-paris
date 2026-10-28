/** Line icons on a 24 × 24 grid, drawn in the surrounding text colour. */
const GLYPHS = {
  bike: [
    "M5.5 13.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z",
    "M18.5 13.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z",
    "M5.5 17l4-8h6l3 8M9.5 9L8 6H6M15.5 9l-1-3h2",
  ],
  close: ["M6 6l12 12M18 6L6 18"],
  fork: [
    "M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4-3.5 8h3.5",
  ],
  moon: ["M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"],
  pin: [
    "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z",
    "M12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z",
  ],
  plus: ["M12 5v14M5 12h14"],
  sun: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z",
    "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  ],
  train: ["M5 3h14v14H5z", "M5 11h14M8 21l2-4M16 21l-2-4"],
  trash: ["M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"],
  weather: [
    "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z",
    "M9 1.5v1.5M2.5 8H4M4.4 3.4l1 1M13.6 3.4l-1 1",
    "M8 20h9a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A3.3 3.3 0 0 0 8 20z",
  ],
} as const;

export type IconName = keyof typeof GLYPHS;

interface IconProps {
  name: IconName;
  size?: number;
  weight?: number;
}

export const Icon = ({ name, size = 22, weight = 2.2 }: IconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={weight}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {GLYPHS[name].map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);
