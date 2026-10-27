import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
type AccountSectionProps = {
  children: ReactNode;
  description: string;
  title: string;
};
export const AccountSection = ({
  title,
  description,
  children,
}: AccountSectionProps) => (
  <Card className="gap-7 rounded-2xl bg-card py-7 shadow-none ring-border sm:py-9">
    <CardHeader className="px-6 sm:px-9">
      <CardTitle className="text-xl tracking-tight">
        <h2>{title}</h2>
      </CardTitle>
      <CardDescription className="mt-1 leading-relaxed">
        {description}
      </CardDescription>
    </CardHeader>
    <CardContent className="px-6 sm:px-9">{children}</CardContent>
  </Card>
);
