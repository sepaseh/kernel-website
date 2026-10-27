import { type ComponentProps, useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
type Props = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
};
export const FormField = ({
  "aria-describedby": externalDescription,
  className,
  id,
  name,
  label,
  hint,
  error,
  ...props
}: Props) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const description = error || hint;
  const describedBy =
    [externalDescription, description ? `${fieldId}-description` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="space-y-2.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        {...props}
        name={name}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn("h-12 rounded-lg px-3.5 text-base", className)}
      />
      {description ? (
        <p
          id={`${fieldId}-description`}
          className={
            error
              ? "text-sm text-destructive"
              : "text-sm leading-relaxed text-muted-foreground"
          }
        >
          {description}
        </p>
      ) : null}
    </div>
  );
};
