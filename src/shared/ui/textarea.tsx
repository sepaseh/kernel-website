import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

type Props = ComponentProps<"textarea">;
export function Textarea({ className, ...props }: Props) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-40 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-3.5 py-3 text-base leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground focus-visible:ring-2 focus-visible:ring-background disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 aria-invalid:border-destructive dark:bg-muted/35",
        className,
      )}
      {...props}
    />
  );
}
