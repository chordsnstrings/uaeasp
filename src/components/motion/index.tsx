"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Wrap public pages once; keeps the motion bundle small via LazyMotion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}

export { m, AnimatePresence };

/** Fade + rise into view on scroll, once. Skips the hidden state entirely for
 * reduced-motion users so content is never invisible for them. */
export function FadeIn({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const MotionTag = m[Tag];
  const reduced = useReducedMotion();
  return (
    <MotionTag
      className={className}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.6, 0.2, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/** Stagger children fade-ins (use on grids/lists). */
export function StaggerGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.2, 0.6, 0.2, 1] },
        },
      }}
    >
      {children}
    </m.div>
  );
}

/** Emphasised phrase, underscored by a clay rule that draws itself in when
 * the heading is scrolled into view. Use inside headings via t.rich:
 * <Highlight>key phrase</Highlight>.
 *
 * The height is pinned at 2px rather than 100%: the rule sits under the
 * words now instead of washing behind them, so animating the full height
 * would flood the phrase with colour on arrival. */
export function Highlight({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.span
      className="marker"
      initial={reduced ? { backgroundSize: "100% 2px" } : { backgroundSize: "0% 2px" }}
      whileInView={{ backgroundSize: "100% 2px" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0.6, 0.2, 1] }}
    >
      {children}
    </m.span>
  );
}

/**
 * A hairline that draws itself when its section arrives.
 *
 * This is the site's one signature movement, and it is deliberately the
 * quietest thing that could work: a page laid out on rules should be seen to
 * draw them. It runs once per section, never on a loop, and reduced-motion
 * readers get the finished rule with no animation at all.
 *
 * The origin flips with the writing direction — a rule that draws itself
 * right-to-left in an English page reads as an error, and the reverse is
 * true in Arabic.
 */
export function DrawRule({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <m.span
      aria-hidden
      className={`origin-left rtl:origin-right ${className}`}
      initial={reduced ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.9, ease: [0.2, 0.6, 0.2, 1] }}
    />
  );
}

/** Animated count-up number (used for stats). */
export function AnimatedNumber({
  value,
  className,
  durationMs = 1200,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, durationMs, reduced]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}
