"use client";

import { useScroll, useSpring, useReducedMotion } from "motion/react";
import { m } from "@/components/motion";

/**
 * A one-pixel clay rule at the very top of the window, tracking how far
 * through the page you are. Damped rather than springy: it should follow the
 * scroll, not chase it.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 40,
    restDelta: 0.001,
  });
  const reduced = useReducedMotion();

  return (
    <m.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-px origin-left bg-accent-500 rtl:origin-right"
      style={{ scaleX: reduced ? scrollYProgress : scaleX }}
    />
  );
}
