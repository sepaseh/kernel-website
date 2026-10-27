// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, it, vi } from "vitest";

import { Preferences } from "./Preferences";

it("toggles only the theme using the actual provider and keeps icons decorative", async () => {
  window.localStorage.clear();
  const write = vi.spyOn(Storage.prototype, "setItem");
  render(
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="kernel-website-theme"
    >
      <Preferences themeLabel="Change theme" />
    </ThemeProvider>,
  );
  const button = screen.getByRole("button", { name: "Change theme" });
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true),
  );
  expect(button.querySelectorAll("svg")).toHaveLength(2);
  for (const icon of button.querySelectorAll("svg")) {
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("width")).toBe("18");
    expect(icon.getAttribute("stroke")).toBe("currentColor");
  }
  fireEvent.click(button);
  await waitFor(() =>
    expect(document.documentElement.classList.contains("light")).toBe(true),
  );
  expect(window.localStorage.getItem("kernel-website-theme")).toBe("light");
  fireEvent.click(button);
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true),
  );
  expect(
    write.mock.calls.every(([key]) => key === "kernel-website-theme"),
  ).toBe(true);
});
