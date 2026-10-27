import { MotionConfigContext } from "motion/react";
import { createElement, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/SessionProvider";
import { TestIntlProvider } from "@/test/intl";

import { Providers } from "./Providers";

function Probe() {
  const motion = useContext(MotionConfigContext);
  const session = useSession();
  return createElement(
    "h1",
    { "data-motion": motion.reducedMotion, "data-loading": session.loading },
    "Visible initial content",
  );
}

describe("provider composition static markup", () => {
  it("preserves initial content, session scope, user motion policy and an explicit theme script nonce", () => {
    const html = renderToStaticMarkup(
      createElement(
        TestIntlProvider,
        null,
        createElement(Providers, {
          nonce: "synthetic-csp-nonce",
          children: createElement(Probe),
        }),
      ),
    );
    expect(html).toContain('nonce="synthetic-csp-nonce"');
    expect(html).toContain('data-motion="user"');
    expect(html).toContain('data-loading="true"');
    expect(html).toContain("Visible initial content");
    expect(html).toContain("kernel-website-theme");
    expect(html).not.toMatch(/opacity:0|display:none|visibility:hidden/);
  });

  it("does not invent a nonce when one was not supplied", () => {
    const html = renderToStaticMarkup(
      createElement(
        TestIntlProvider,
        null,
        createElement(Providers, { children: "Content" }),
      ),
    );
    expect(html).toContain("Content");
    expect(html).not.toContain("nonce=");
  });
});
