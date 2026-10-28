import type { ReactNode } from "react";

import type { SkyKind } from "../lib/api";

const SUN = "var(--gold)";
const CLOUD = "var(--cream)";

const Cloud = ({ d }: { d: string }) => <path d={d} fill={CLOUD} />;

const BIG_CLOUD =
  "M13 36h22a8 8 0 0 0 0-16 10 10 0 0 0-19 3 6.5 6.5 0 0 0-3 13z";

const HIGH_CLOUD =
  "M13 30h22a8 8 0 0 0 0-16 10 10 0 0 0-19 3 6.5 6.5 0 0 0-3 13z";

const DRAWINGS: Record<SkyKind, ReactNode> = {
  cloud: <Cloud d={BIG_CLOUD} />,
  fog: (
    <>
      <Cloud d={HIGH_CLOUD} />
      <path d="M10 36h28M14 41h20" />
    </>
  ),
  moon: (
    <path d="M34 28A13 13 0 1 1 20 12a10.5 10.5 0 0 0 14 16z" fill={CLOUD} />
  ),
  part: (
    <>
      <circle cx="18" cy="17" r="7" fill={SUN} />
      <path d="M18 4v3M5 17h3M7.5 7.5l2 2M28.5 7.5l-2 2" />
      <Cloud d="M16 38h20a7 7 0 0 0 0-14 9 9 0 0 0-17 3 5.5 5.5 0 0 0-3 11z" />
    </>
  ),
  rain: (
    <>
      <Cloud d={HIGH_CLOUD} />
      <path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5" stroke="var(--focus)" />
    </>
  ),
  snow: (
    <>
      <Cloud d={HIGH_CLOUD} />
      <path d="M17 36v4M15 38h4M25 36v4M23 38h4M33 36v4M31 38h4" />
    </>
  ),
  storm: (
    <>
      <Cloud d={HIGH_CLOUD} />
      <path d="M24 31l-4 7h6l-3 6" fill="none" stroke="var(--gold)" />
    </>
  ),
  sun: (
    <>
      <circle cx="24" cy="24" r="9" fill={SUN} />
      <path d="M24 6v5M24 37v5M6 24h5M37 24h5M11.3 11.3l3.5 3.5M33.2 33.2l3.5 3.5M36.7 11.3l-3.5 3.5M14.8 33.2l-3.5 3.5" />
    </>
  ),
};

/** The sky, drawn in ink with Cute Matcha's gold sun and cream clouds. */
export const SkyIcon = ({
  sky,
  size = 40,
  label,
}: {
  sky: SkyKind;
  size?: number;
  /** Set when the drawing is the only place the sky is named. */
  label?: string;
}) => (
  <svg
    {...(label
      ? { "aria-label": label, role: "img" }
      : { "aria-hidden": true })}
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="var(--ink)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {DRAWINGS[sky]}
  </svg>
);
