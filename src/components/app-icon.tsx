/**
 * The app's icon, a little metro train, drawn flat in Cute Matcha's Light
 * Matcha colours, the same in both themes: it is also public/favicon.svg.
 * Its 1.5px `text` rim disappears in Light Matcha and turns cream in Dark
 * Matcha, so its edge reads on either header.
 */
export const AppIcon = ({ size = 40 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40">
    <rect
      x="3"
      y="3"
      width="34"
      height="34"
      rx="9"
      fill="#d4dd9c"
      stroke="var(--text)"
      strokeWidth="1.5"
    />
    <rect
      x="11"
      y="8"
      width="18"
      height="20"
      rx="5"
      fill="#fff3cf"
      stroke="#2f3b34"
      strokeWidth="1.5"
    />
    <rect
      x="14"
      y="11.5"
      width="12"
      height="7"
      rx="1.5"
      fill="#afc584"
      stroke="#2f3b34"
      strokeWidth="1.2"
    />
    <circle cx="15.5" cy="23.5" r="1.4" fill="#2f3b34" />
    <circle cx="24.5" cy="23.5" r="1.4" fill="#2f3b34" />
    <path
      d="M14 28l-3 4M26 28l3 4"
      stroke="#2f3b34"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
