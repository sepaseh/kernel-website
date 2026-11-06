// @vitest-environment jsdom
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import english from "@/i18n/catalog-data/locales/en.json";

import GlobalError from "./global-error";

describe("standalone root error fallback", () => {
  it("provides a standalone bilingual fallback and a native reload action without context", () => {
    const fallback = GlobalError();
    const markup = renderToStaticMarkup(fallback);
    expect(markup).toContain('<html lang="en" dir="ltr"');
    expect(markup).toContain('<section lang="fa" dir="rtl"');
    expect(markup).toContain(english.globalErrorText);
    expect(markup).toContain('name="robots" content="noindex, nofollow"');
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const actions: Array<() => void> = [];
    const visit = (node: ReactNode) => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (
        isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)
      ) {
        if (node.type === "button" && node.props.onClick)
          actions.push(node.props.onClick);
        visit(node.props.children);
      }
    };
    try {
      visit(fallback);
      expect(actions).toHaveLength(1);
      actions[0]();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
