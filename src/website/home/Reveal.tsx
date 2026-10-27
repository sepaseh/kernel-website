"use client";
import { domAnimation, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
type Props = { children: ReactNode; className?: string; delay?: number };
export const Reveal = ({ children, className, delay = 0 }: Props) => {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={reduced ? false : { y: 18 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-20px" }}
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
