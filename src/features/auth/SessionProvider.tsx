"use client";
import { useLocale } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getAccount } from "@/features/account/api";
import { WebsiteApiError } from "@/shared/api/client";
import type { Account } from "@/shared/contracts";
type Session = {
  account?: Account;
  loading: boolean;
  error?: unknown;
  refresh: () => void;
  acceptAccount: (account: Account) => void;
};
const SessionContext = createContext<Session | undefined>(undefined);
type Props = { children: ReactNode };
export const SessionProvider = ({ children }: Props) => {
  const locale = useLocale();
  const [request, setRequest] = useState({ locale, version: 0 });
  if (request.locale !== locale)
    setRequest({ locale, version: request.version + 1 });
  const key = `${locale}:${request.version}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    account?: Account;
    error?: unknown;
  }>({ key: "" });
  const refresh = useCallback(
    () =>
      setRequest((current) => ({
        ...current,
        version: current.version + 1,
      })),
    [],
  );
  const acceptAccount = useCallback(
    (account: Account) =>
      setSnapshot((current) =>
        // A completed mutation cannot be cancelled retroactively. Only its own
        // loaded session may accept the response; a later login keeps its state.
        current.key === key ? { key, account } : current,
      ),
    [key],
  );
  useEffect(() => {
    const controller = new AbortController();
    getAccount(locale, controller.signal).then(
      (account) => {
        if (!controller.signal.aborted) setSnapshot({ key, account });
      },
      (error) => {
        if (!controller.signal.aborted)
          setSnapshot({
            key,
            error:
              error instanceof WebsiteApiError && error.status === 401
                ? undefined
                : error,
          });
      },
    );
    return () => controller.abort();
  }, [key, locale]);
  useEffect(() => {
    window.addEventListener("kernel:session-expired", refresh);
    return () => window.removeEventListener("kernel:session-expired", refresh);
  }, [refresh]);
  const current = snapshot.key === key;
  const value = useMemo<Session>(
    () => ({
      account: current ? snapshot.account : undefined,
      loading: !current,
      error: current ? snapshot.error : undefined,
      refresh,
      acceptAccount,
    }),
    [acceptAccount, current, refresh, snapshot],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("The session provider is missing.");
  return session;
}
