"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

type Props = { themeLabel: string };

export const Preferences = ({ themeLabel }: Props) => {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-10"
        aria-label={themeLabel}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun
          size={18}
          color="currentColor"
          className="hidden size-[18px] dark:block"
          aria-hidden
        />
        <Moon
          size={18}
          color="currentColor"
          className="size-[18px] dark:hidden"
          aria-hidden
        />
      </Button>
    </div>
  );
};
