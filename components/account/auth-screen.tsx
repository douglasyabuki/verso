"use client";

import { ArrowLeft, LoaderCircle, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ProviderIcon } from "@/components/account/provider-icon";
import { BrandLockup } from "@/components/brand/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { authErrorMessage } from "@/lib/account/auth-feedback";
import { authPagePath, safeReturnPath } from "@/lib/account/return-path";
import {
  type AccountProviders,
  AccountSessionStore,
} from "@/stores/account/session";
import {
  ACCOUNT_PROVIDER_NAMES,
  ACCOUNT_PROVIDERS,
} from "@/types-and-constants/account";

const subscribe = () => () => {};

/** Read the current query without a Suspense boundary; the server snapshot is empty.
 * @returns {string} `location.search` after hydration, otherwise an empty string.
 */
function useSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
}

/** Sign-in or sign-up page with one button per configured provider.
 * Sign-in never creates an account; sign-up explicitly requests one. Both return to
 * the validated `next` workspace destination.
 * @param props `mode` selects the page.
 * @returns The full-page auth screen.
 * @example <AuthScreen mode="sign-up" />
 */
export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const search = useSearch();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const params = new URLSearchParams(search);
  const next = safeReturnPath(params.get("next"));
  const signingUp = mode === "sign-up";
  const [store] = useState(() => new AccountSessionStore());
  const [providers, setProviders] = useState<AccountProviders | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<keyof AccountProviders | null>(null);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    let cancelled = false;
    void store.prepareSignIn().then((result) => {
      if (cancelled) return;
      setProviders(result);
      setOptionsFailed(result === null);
    });
    return () => {
      cancelled = true;
    };
  }, [store, attempt]);

  const callbackError = params.get("error");
  const error = failure || authErrorMessage(callbackError);
  const accountMissing = callbackError?.toLowerCase() === "signup_disabled";
  const anyProvider = !!providers && (providers.github || providers.google);

  const start = async (provider: keyof AccountProviders) => {
    setPending(provider);
    setFailure("");
    const result = await store.signIn(provider, next, {
      signUp: signingUp,
      errorPath: authPagePath(mode, next),
    });
    if (result) {
      setFailure(result);
      setPending(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-10">
        <Link href="/" aria-label="Verso home" className="rounded-md">
          <BrandLockup />
        </Link>
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Back
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1
              data-slot="card-title"
              className="font-heading text-xl leading-snug font-medium"
            >
              {signingUp ? "Create your Verso account" : "Welcome back"}
            </h1>
            <CardDescription>
              {signingUp
                ? "Keep your career record and resumes in an account you can open on any device."
                : "Sign in with the method you connected to your Verso account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {ACCOUNT_PROVIDERS.map((provider) => {
                const name = ACCOUNT_PROVIDER_NAMES[provider];
                const unavailable = providers !== null && !providers[provider];
                const busy = pending === provider;
                return (
                  <div key={provider} className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="w-full"
                      disabled={
                        !hydrated || !providers || unavailable || !!pending
                      }
                      aria-busy={busy}
                      aria-describedby={
                        unavailable ? `${provider}-unavailable` : undefined
                      }
                      onClick={() => void start(provider)}
                    >
                      {busy ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ProviderIcon
                          provider={provider}
                          data-icon="inline-start"
                        />
                      )}
                      {busy
                        ? `Connecting to ${name}…`
                        : `${signingUp ? "Sign up" : "Continue"} with ${name}`}
                    </Button>
                    {unavailable && anyProvider && (
                      <p
                        id={`${provider}-unavailable`}
                        className="text-xs text-muted-foreground"
                      >
                        {name} sign-in is not available on this deployment.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {providers && !anyProvider && (
              <Alert>
                <AlertDescription>
                  Accounts are not enabled on this deployment. You can still use
                  Verso as a guest; your work is saved in this browser.
                </AlertDescription>
              </Alert>
            )}
            {optionsFailed && (
              <Alert variant="destructive">
                <AlertDescription>
                  Sign-in options could not be loaded.
                </AlertDescription>
                <Button
                  variant="outline"
                  className="mt-2 self-start"
                  onClick={() => {
                    setOptionsFailed(false);
                    setAttempt((value) => value + 1);
                  }}
                >
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  Retry
                </Button>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" aria-label="Sign-in error">
                <AlertDescription>
                  {error}
                  {accountMissing && !signingUp && (
                    <>
                      {" "}
                      <Link
                        className="text-primary underline underline-offset-4"
                        href={authPagePath("sign-up", next)}
                      >
                        Create an account
                      </Link>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>No Verso password. Google or GitHub confirms who you are.</li>
              <li>
                {signingUp
                  ? "Your guest workspace stays in this browser. You can review and import it after signing up."
                  : "Signing in does not move, merge, or replace your guest workspace."}
              </li>
              <li>
                After signing in, connect the other provider from Settings ›
                Account to sign in with either one.
              </li>
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              {signingUp ? "Already have an account?" : "New to Verso?"}{" "}
              <Link
                className="text-primary underline underline-offset-4"
                href={authPagePath(signingUp ? "sign-in" : "sign-up", next)}
              >
                {signingUp ? "Sign in" : "Create an account"}
              </Link>
            </p>
            <Link
              href={next}
              className={buttonVariants({ variant: "link", className: "px-0" })}
            >
              <UserRound data-icon="inline-start" aria-hidden="true" />
              Continue as guest
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
