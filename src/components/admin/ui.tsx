import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared admin primitives.
 *
 * Every admin page previously rebuilt its own table markup, its own status
 * pill and its own card, so nineteen screens drifted apart and none of them
 * matched the public site. These are the contract: one Card, one Badge, one
 * DataTable, one StatCard, one chart pair. Pages compose them and stop
 * inventing.
 *
 * Visual language is the Ledger system the public site already uses — paper
 * surfaces, ink text, the display face for headings and tabular figures for
 * every number, so digits line up in columns instead of jittering.
 */

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title,
  subtitle,
  count,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-200/70 pb-5">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-[1.75rem]">
          {title}
          {count !== undefined && (
            <span className="num ms-2 align-middle text-base font-medium text-ink-400">
              {count.toLocaleString()}
            </span>
          )}
        </h1>
        {subtitle && <div className="mt-1.5 text-sm text-ink-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-ink-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.15)] ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-bold tracking-tight text-ink-900">{children}</h2>
        {hint && <p className="mt-1 text-xs leading-relaxed text-ink-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

export type Tone = "neutral" | "brand" | "positive" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  positive: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`stamp inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase leading-4 tracking-[0.08em] ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A small coloured dot — for "is this thing on" without stealing attention. */
export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const fill: Record<Tone, string> = {
    neutral: "bg-ink-300",
    brand: "bg-brand-500",
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-sky-500",
  };
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${fill[tone]}`} />;
}

/* -------------------------------------------------------------------- stats */

export function StatCard({
  label,
  value,
  hint,
  delta,
  spark,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Percentage change against the previous period. */
  delta?: number | null;
  /** Series for the inline sparkline. */
  spark?: number[];
  href?: string;
  tone?: Tone;
}) {
  const accent: Record<Tone, string> = {
    neutral: "text-ink-900",
    brand: "text-brand-800",
    positive: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    info: "text-sky-800",
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {label}
        </p>
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span
            className={`num text-[11px] font-semibold ${
              delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-ink-400"
            }`}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(Math.round(delta))}%
          </span>
        )}
      </div>
      <p className={`num mt-2 text-[2rem] font-bold leading-none tracking-tight ${accent[tone]}`}>
        {value}
      </p>
      {spark && spark.length > 1 && (
        <div className="mt-3">
          <Sparkline values={spark} tone={tone} />
        </div>
      )}
      {hint && <p className="mt-2 text-xs leading-relaxed text-ink-500">{hint}</p>}
    </>
  );

  const shell =
    "block rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors";
  return href ? (
    <Link href={href} className={`${shell} press hover:border-brand-300 hover:bg-brand-50/30`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/* ------------------------------------------------------------------- charts */

const STROKE: Record<Tone, string> = {
  neutral: "var(--color-ink-400)",
  brand: "var(--color-brand-600)",
  positive: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  info: "#0284c7",
};

/**
 * Inline SVG sparkline.
 *
 * Hand-rolled rather than pulled from a chart library: a strict CSP blocks
 * CDN scripts, the whole admin is server-rendered, and a trend line needs a
 * path and nothing else. No dependency, no client bundle, no hydration.
 */
export function Sparkline({
  values,
  tone = "brand",
  height = 28,
}: {
  values: number[];
  tone?: Tone;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const w = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="h-7 w-full"
      role="img"
      aria-label={`Trend: ${values.join(", ")}`}
    >
      <polyline
        points={`0,${height} ${pts.join(" ")} ${w},${height}`}
        fill={STROKE[tone]}
        opacity="0.08"
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Horizontal bars — the right shape for a ranked breakdown. */
export function BarList({
  items,
  tone = "brand",
  emptyLabel = "Nothing yet.",
}: {
  items: { label: string; value: number; href?: string; hint?: string }[];
  tone?: Tone;
  emptyLabel?: string;
}) {
  if (!items.length) return <p className="text-sm text-ink-500">{emptyLabel}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  const fill: Record<Tone, string> = {
    neutral: "bg-ink-200",
    brand: "bg-brand-200",
    positive: "bg-emerald-200",
    warning: "bg-amber-200",
    danger: "bg-red-200",
    info: "bg-sky-200",
  };
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const row = (
          <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg px-2.5 py-2">
            <div
              aria-hidden
              className={`absolute inset-y-0 start-0 rounded-lg ${fill[tone]} opacity-60`}
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
            <span className="relative min-w-0 truncate text-sm text-ink-800">{item.label}</span>
            <span className="num relative shrink-0 text-sm font-semibold text-ink-900">
              {item.value.toLocaleString()}
              {item.hint && (
                <span className="ms-1.5 text-[11px] font-normal text-ink-500">{item.hint}</span>
              )}
            </span>
          </div>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className="block hover:opacity-80">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical columns over time, with the axis labelled at both ends. */
export function ColumnChart({
  points,
  tone = "brand",
  height = 132,
}: {
  points: { label: string; value: number }[];
  tone?: Tone;
  height?: number;
}) {
  if (!points.length) return <p className="text-sm text-ink-500">No data for this period yet.</p>;
  const max = Math.max(1, ...points.map((p) => p.value));
  const fill: Record<Tone, string> = {
    neutral: "bg-ink-300",
    brand: "bg-brand-500",
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-sky-500",
  };
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {points.map((p) => (
          <div key={p.label} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="num text-[10px] font-semibold text-ink-400 opacity-0 transition-opacity group-hover:opacity-100">
              {p.value}
            </span>
            <div
              className={`w-full rounded-t-md ${fill[tone]} opacity-85 transition-opacity group-hover:opacity-100`}
              style={{ height: `${Math.max(2, (p.value / max) * (height - 18))}px` }}
              title={`${p.label}: ${p.value}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-ink-100 pt-1.5">
        <span className="num text-[10px] text-ink-400">{points[0]?.label}</span>
        <span className="num text-[10px] text-ink-400">{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- table */

export function DataTable({
  head,
  children,
  minWidth = "44rem",
}: {
  head: ReactNode[];
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200/70 bg-white">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="sticky top-0 z-10 bg-paper-dark/95 backdrop-blur">
          <tr className="border-b border-ink-200/70">
            {head.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500 first:ps-5 last:pe-5"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="align-top transition-colors hover:bg-paper/60">{children}</tr>;
}

export function Cell({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 first:ps-5 last:pe-5 ${className}`}>
      {children}
    </td>
  );
}

/** An empty state that offers the next action instead of just saying "none". */
export function EmptyState({
  title,
  body,
  action,
  colSpan,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  colSpan?: number;
}) {
  const inner = (
    <div className="mx-auto max-w-sm py-10 text-center">
      <p className="font-display text-sm font-bold text-ink-700">{title}</p>
      {body && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
  return colSpan ? (
    <tr>
      <td colSpan={colSpan}>{inner}</td>
    </tr>
  ) : (
    inner
  );
}

/* ------------------------------------------------------------------ buttons */

export function ButtonLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-ink-900 text-white hover:bg-ink-800"
      : "border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-800";
  return (
    <Link
      href={href}
      className={`press inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}

/** Definition pair used across every detail screen. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink-900">{children}</dd>
    </div>
  );
}
