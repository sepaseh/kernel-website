"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/SessionProvider";

type Props = { accountLabel: string; loginLabel: string };

export const HeaderAccountLink = ({ accountLabel, loginLabel }: Props) => {
  const { account } = useSession();
  return (
    <Button variant="outline" className="h-10 gap-2 px-3 sm:px-4" asChild>
      <Link href={account ? "/account" : "/login"}>
        {account ? accountLabel : loginLabel}
        <ArrowUpRight
          size={16}
          color="currentColor"
          className="hidden size-4 sm:block rtl:-rotate-90"
          aria-hidden
        />
      </Link>
    </Button>
  );
};
