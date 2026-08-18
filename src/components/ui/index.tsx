import type { ReactNode } from "react";

/**
 * The vocabulary the site is built from.
 *
 * Every page before this file existed spelled its own buttons, its own
 * section padding and its own eyebrow labels inline, which is why there were
 * four button treatments and three heading scales in circulation. A design
 * this spare has nowhere to hide that kind of drift: with no shadows, no
 * gradients and one accent colour, the only things holding a page together
 * are the measure, the rhythm and the rules — so those are the things that
 * have to be defined once.
 *
 * Deliberately not a component library. These are class strings and thin
 * wrappers, usable from server components, with no state and no runtime.
 */

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "solid" | "outline" | "quiet" | "accent" | "onDark";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  /* The default. Near-black on linen: the strongest thing on the page, and
     the reason the accent almost never has to be spent on a button. */
  solid: "bg-ink-900 text-paper hover:bg-brand-900",
  outline: "border border-ink-300 text-ink-800 hover:border-ink-900 hover:bg-ink-50",
  quiet: "text-brand-700 underline-offset-4 hover:text-brand-900 hover:underline",
  /* Clay. Reserved for the one action on a page that is time-bound — a
     deadline, a penalty. If two of these appear on a screen, one is wrong. */
  accent: "bg-accent-600 text-white hover:bg-accent-700",
  onDark: "border border-white/25 text-white hover:border-white/70 hover:bg-white/5",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function buttonClass({
  variant = "solid",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  const base =
    "press inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight disabled:opacity-50 disabled:pointer-events-none";
  const shape = variant === "quiet" ? "" : SIZES[size];
  return [base, shape, VARIANTS[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

/** The arrow that follows a "read on" link. Flips with the writing direction. */
export function Arrow() {
  return (
    <span
      aria-hidden
      className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
    >
      →
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

/** One measure for the whole site. Everything lines up on the same two edges. */
export function Container({
  children,
  className = "",
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  /** `wide` for indexes and grids, `text` for anything meant to be read. */
  width?: "wide" | "text";
}) {
  const max = width === "text" ? "max-w-3xl" : "max-w-6xl";
  return <div className={`mx-auto ${max} px-5 sm:px-8 ${className}`}>{children}</div>;
}

/**
 * A band of the page.
 *
 * `tone` is the only decision: linen is the default ground, `sunken` is the
 * half-tone used to group an index, and `dark` is the spruce block that
 * opens and closes a page. There is no fourth option on purpose.
 */
export function Section({
  children,
  className = "",
  tone = "paper",
  bordered = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "sunken" | "dark";
  bordered?: boolean;
}) {
  const tones = {
    paper: "",
    sunken: "bg-paper-dark",
    dark: "grain bg-brand-950 text-brand-100",
  } as const;
  const border = bordered ? "border-y border-ink-200" : "";
  return (
    <section className={`${tones[tone]} ${border} ${className}`}>{children}</section>
  );
}

/** A hairline. Full-bleed inside its container; the site's main punctuation. */
export function Rule({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-ink-200 ${className}`} aria-hidden />;
}

/**
 * The label above a heading — optionally numbered, always followed by a rule
 * that runs to the edge of the measure.
 *
 * The number is what makes a page read as an index rather than as a series
 * of pitches, which is the single largest difference between this design and
 * the one it replaces.
 */
export function Eyebrow({
  children,
  index,
  className = "",
  tone = "ink",
}: {
  children?: ReactNode;
  index?: number;
  className?: string;
  tone?: "ink" | "light";
}) {
  const color = tone === "light" ? "text-brand-300" : "text-ink-500";
  const rule = tone === "light" ? "bg-white/20" : "bg-ink-300";
  return (
    <p className={`eyebrow flex items-center gap-3 ${color} ${className}`}>
      {index !== undefined && <span aria-hidden>{String(index).padStart(2, "0")}</span>}
      {children}
      <span aria-hidden className={`h-px flex-1 ${rule}`} />
    </p>
  );
}

/**
 * A page's opening: marker, headline, and one paragraph of standfirst.
 *
 * The headline is set in the serif because it is the only line on the page
 * that gets to be large, and because a single well-set serif line does more
 * work than any illustration this site could honestly use.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      {eyebrow && <Eyebrow className="mb-6">{eyebrow}</Eyebrow>}
      <h1 className="display-serif max-w-3xl text-4xl text-ink-900 sm:text-5xl lg:text-6xl">
        {title}
      </h1>
      {lede && (
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">{lede}</p>
      )}
      {children}
    </header>
  );
}

/** A bordered white block on the linen. The only kind of container there is. */
export function Panel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "aside" | "form";
}) {
  return (
    <Tag className={`border border-ink-200 bg-white ${className}`}>{children}</Tag>
  );
}

/** A figure and its caption. Figures are mono and tabular; captions are small. */
export function Stat({
  value,
  label,
  className = "",
}: {
  value: ReactNode;
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="num text-4xl font-medium tracking-tight text-ink-900 sm:text-5xl">
        {value}
      </p>
      <p className="eyebrow mt-3 text-ink-500">{label}</p>
    </div>
  );
}
