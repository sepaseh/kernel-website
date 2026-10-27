"use client";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { SessionProvider } from "@/features/auth/SessionProvider";
type Props = { children: ReactNode; nonce?: string };
export const Providers = ({ children, nonce }: Props) => (
  <ThemeProvider
    nonce={nonce}
    attribute="class"
    defaultTheme="dark"
    enableSystem={false}
    storageKey="kernel-website-theme"
    disableTransitionOnChange
  >
    <MotionConfig reducedMotion="user">
      <SessionProvider>{children}</SessionProvider>
    </MotionConfig>
  </ThemeProvider>
);
