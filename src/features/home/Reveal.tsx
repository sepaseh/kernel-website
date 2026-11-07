"use client";
import { domMin, LazyMotion, useInView, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode, useRef } from "react";
type Props = { children: ReactNode; className?: string; delay?: number };
/**
 * Keeps server-rendered content visible and delegates animation cleanup to Motion.
 * Reduced motion disables the initial displacement, duration and delay.
 */
export const Reveal = ({ children, className, delay = 0 }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domMin} strict>
      <m.div
        ref={ref}
        className={className}
        initial={reduced ? false : { y: 18 }}
        animate={inView ? { y: 0 } : {}}
        transition={{
          duration: reduced ? 0 : 0.55,
          delay: reduced ? 0 : delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
};
