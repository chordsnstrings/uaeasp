/** The Ledger icon set: thin-stroke document-world glyphs, one weight,
 * replacing emoji throughout. All render from currentColor. */

interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** Brand mark: an invoice slip with a validation tick — the site in one glyph. */
export function LogoMark({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3z" />
      <path d="M9 7.5h6M9 11h6" />
      <path d="M9.5 15.5l1.8 1.8 3.2-3.6" strokeWidth={1.9} />
    </svg>
  );
}

export function IconCalculator({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8.5 7h7" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v3M8.5 18h.01M12 18h.01" strokeWidth={2.2} />
    </svg>
  );
}

export function IconCalendar({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="5" width="16" height="16" rx="1.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
      <path d="M8 13.5h3M8 17h5.5" />
    </svg>
  );
}

export function IconChecklist({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
      <path d="M8 8.2l1.2 1.2 2-2.3M13.5 8.5H16" />
      <path d="M8 12.7l1.2 1.2 2-2.3M13.5 13H16" />
      <path d="M8 17.2l1.2 1.2 2-2.3M13.5 17.5H16" />
    </svg>
  );
}

export function IconGauge({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l3.5-4.5" strokeWidth={1.9} />
      <path d="M4.5 19h15" />
    </svg>
  );
}

export function IconMagnifier({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="3.5" width="12" height="15" rx="1.5" />
      <path d="M7 7.5h6M7 10.5h4" />
      <circle cx="15" cy="15" r="3.8" />
      <path d="M17.8 17.8L21 21" />
    </svg>
  );
}

export function IconStamp({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9.5 10.5c0-1 .8-1.5 .8-3a1.7 1.7 0 1 1 3.4 0c0 1.5 .8 2 .8 3v1.5h-5v-1.5z" />
      <path d="M6 15.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.5H6v-1.5z" />
      <path d="M5.5 20.5h13" />
    </svg>
  );
}

export function IconSeal({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="10" r="5.5" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M9 14.5L7.5 21l3-1.6L12 21l1.5-1.6 3 1.6L15 14.5" />
    </svg>
  );
}

export function IconTarget({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
