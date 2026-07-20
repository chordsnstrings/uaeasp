"use client";

import { useScroll, useSpring, useReducedMotion } from "motion/react";
import { m } from "@/components/motion";

/**
 * Thin brand-colored reading-progress bar pinned under the header.
 * Springy so it feels alive without being distracting.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 28,
    restDelta: 0.001,
  });
  const reduced = useReducedMotion();

  return (
    <m.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 rtl:origin-right"
      style={{ scaleX: reduced ? scrollYProgress : scaleX }}
    />
  );
}
