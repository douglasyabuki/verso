"use client";

import {
  Check,
  Link as LinkIcon,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ProviderIcon } from "@/components/account/provider-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/account/auth-feedback";
import { workspaceBasePath } from "@/lib/career/navigation";
import type {
  AccountProviders,
  AccountSessionStore,
  LinkedAccount,
} from "@/stores/account/session";
import {
  ACCOUNT_PROVIDER_NAMES,
  ACCOUNT_PROVIDERS,
} from "@/types-and-constants/account";

type Provider = keyof AccountProviders;

/** Query parameters a provider round trip adds to the account settings URL. */
const RESULT_KEYS = ["connection", "provider", "error", "error_description"];

const ACCOUNT_SETTINGS = `${workspaceBasePath}/settings/account`;

/** Build the Settings › Account return path for a connection attempt.
 * @param result Outcome marker read back after the provider redirect.
 * @param provider Provider being connected.
 * @returns {string} Same-origin workspace path with result parameters.
 */
function connectionPath(result: "success" | "error", provider: Provider) {
  return `${ACCOUNT_SETTINGS}?${new URLSearchParams({ connection: result, provider })}`;
}

/** Read the connection result left in the URL by a provider redirect, once per mount.
 * @returns {{ status: string | null; provider: Provider | null; code: string | null }} Untrusted result fields; `provider` is null unless it names a known provider.
 */
function readConnectionResult() {
  const params = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const provider = params.get("provider");
  return {
    status: params.get("connection"),
    provider: (ACCOUNT_PROVIDERS as readonly string[]).includes(provider ?? "")
      ? (provider as Provider)
      : null,
    code: params.get("error"),
  };
}

/** Settings › Account › Connected accounts: which providers sign in to this Verso account.
 * Connecting links a provider to the signed-in user; disconnecting keeps at least one method.
 * @param props Session store, configured providers, and the signed-in email.
 * @returns The connected accounts section.
 * @example <ConnectedAccounts store={store} providers={session.providers} email={session.user.email} />
 */
export function ConnectedAccounts({
  store,
  providers,
  email,
}: {
  store: AccountSessionStore;
  providers: AccountProviders;
  email: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reauthenticate, setReauthenticate] = useState(false);
  const [pending, setPending] = useState<Provider | null>(null);
  const [confirmation, setConfirmation] = useState<Provider | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result] = useState(readConnectionResult);
  const consumed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void store.listAccounts().then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setReauthenticate(response.reauthenticate);
        setError("Connected accounts could not be loaded. Please retry.");
        return;
      }
      setAccounts(response.accounts);
      if (consumed.current || !result.status || !result.provider) return;
      consumed.current = true;
      const name = ACCOUNT_PROVIDER_NAMES[result.provider];
      if (
        result.status === "success" &&
        !result.code &&
        response.accounts.some((item) => item.providerId === result.provider)
      )
        setMessage(
          `${name} connected. You can now sign in to this Verso account with ${ACCOUNT_PROVIDERS.filter(
            (provider) =>
              response.accounts.some((item) => item.providerId === provider),
          )
            .map((provider) => ACCOUNT_PROVIDER_NAMES[provider])
            .join(" or ")}.`,
        );
      else setError(authErrorMessage(result.code ?? "unknown"));
      const url = new URL(window.location.href);
      RESULT_KEYS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", url);
    });
    return () => {
      cancelled = true;
    };
  }, [store, attempt, result]);

  const connect = async (provider: Provider) => {
    setPending(provider);
    setError("");
    setMessage("");
    const failure = await store.connect(
      provider,
      connectionPath("success", provider),
      connectionPath("error", provider),
    );
    if (failure) {
      setError(failure);
      setPending(null);
    }
  };

  const disconnect = async (provider: Provider) => {
    const account = accounts?.find((item) => item.providerId === provider);
    if (!account) return;
    setPending(provider);
    setError("");
    setMessage("");
    const failure = await store.disconnect(account.id);
    setPending(null);
    if (failure) {
      setError(failure.error);
      setReauthenticate(failure.reauthenticate);
      return;
    }
    setMessage(`${ACCOUNT_PROVIDER_NAMES[provider]} disconnected.`);
    setAccounts(null);
    setAttempt((value) => value + 1);
  };

  const signInAgain = async (provider: Provider) => {
    setPending(provider);
    const failure = await store.signIn(provider, ACCOUNT_SETTINGS);
    if (failure) {
      setError(failure);
      setPending(null);
    }
  };

  const connected = (provider: Provider) =>
    !!accounts?.some((item) => item.providerId === provider);
  const onlyOne = accounts?.length === 1;

  return (
    <section
      aria-labelledby="connected-accounts-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h3 id="connected-accounts-title" className="font-medium">
          Connected accounts
        </h3>
        <p className="text-sm text-muted-foreground">
          Each connected method signs in to this Verso account ({email}).
          Connect another to keep access if you lose one.
        </p>
      </div>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {ACCOUNT_PROVIDERS.map((provider) => {
          const name = ACCOUNT_PROVIDER_NAMES[provider];
          const linked = connected(provider);
          const last = linked && onlyOne;
          const configured = providers[provider];
          if (!configured && !linked) return null;
          return (
            <li
              key={provider}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <ProviderIcon provider={provider} className="size-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p
                    className={
                      linked
                        ? "flex items-center gap-1 text-xs text-success"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {accounts ? (
                      linked ? (
                        <>
                          <Check className="size-3" aria-hidden="true" />
                          Connected
                        </>
                      ) : (
                        "Not connected"
                      )
                    ) : (
                      "Checking…"
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !accounts || !!pending || last || (!linked && !configured)
                }
                aria-label={`${linked ? "Disconnect" : "Connect"} ${name}`}
                aria-describedby={last ? "last-method-help" : undefined}
                onClick={() =>
                  linked ? setConfirmation(provider) : void connect(provider)
                }
              >
                {pending === provider ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : linked ? (
                  <Unlink data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <LinkIcon data-icon="inline-start" aria-hidden="true" />
                )}
                {pending === provider
                  ? "Working…"
                  : linked
                    ? "Disconnect"
                    : "Connect"}
              </Button>
            </li>
          );
        })}
      </ul>
      {onlyOne && (
        <p id="last-method-help" className="text-xs text-muted-foreground">
          Keep at least one sign-in method connected. To stop using Verso
          entirely, delete your account below.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Signing in with a different Google or GitHub account that is not
        connected here creates or opens a separate Verso account.
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2">
            <span>{error}</span>
            <span className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!!pending}
                onClick={() => {
                  setError("");
                  setAccounts(null);
                  setAttempt((value) => value + 1);
                }}
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Retry
              </Button>
              {reauthenticate &&
                ACCOUNT_PROVIDERS.filter(
                  (provider) => providers[provider] && connected(provider),
                ).map((provider) => (
                  <Button
                    key={provider}
                    variant="outline"
                    size="sm"
                    disabled={!!pending}
                    onClick={() => void signInAgain(provider)}
                  >
                    <LogIn data-icon="inline-start" aria-hidden="true" />
                    Sign in again with {ACCOUNT_PROVIDER_NAMES[provider]}
                  </Button>
                ))}
            </span>
          </AlertDescription>
        </Alert>
      )}
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {confirmation && ACCOUNT_PROVIDER_NAMES[confirmation]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to sign in with{" "}
              {confirmation && ACCOUNT_PROVIDER_NAMES[confirmation]}. Your Verso
              account and workspace stay available through your other connected
              method.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const provider = confirmation;
                setConfirmation(null);
                if (provider) void disconnect(provider);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
