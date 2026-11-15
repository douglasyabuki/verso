import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { getPrisma } from "@/lib/account/prisma";

type Provider = "github" | "google";

/** Report which sign-in providers have complete server configuration.
 * Accounts stay disabled (guest-only app) unless the database, auth secret, base URL,
 * and at least one provider's credentials are present.
 * @returns Provider availability flags.
 * @example if (!accountProviders().github) return
 */
export function accountProviders(): Record<Provider, boolean> {
  const core = Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_URL,
  );
  return {
    github: Boolean(
      core && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
    ),
    google: Boolean(
      core && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
  };
}

/** Report whether any account sign-in is configured.
 * @returns {boolean} True when at least one provider is available.
 * @example if (!accountsEnabled()) return guestOnlyResponse()
 */
export function accountsEnabled(): boolean {
  const providers = accountProviders();
  return providers.github || providers.google;
}

/** Build the auth options from the environment without opening connections.
 * @returns {BetterAuthOptions} Database sessions, configured providers, and explicit-only linking.
 * @example betterAuth(authOptions())
 */
export function authOptions(): BetterAuthOptions {
  const providers = accountProviders();
  return {
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    socialProviders: {
      ...(providers.github
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID!,
              clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            },
          }
        : {}),
      ...(providers.google
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
              prompt: "select_account" as const,
            },
          }
        : {}),
    },
    // Database sessions only: expiry and sign-out apply on the next request.
    session: { cookieCache: { enabled: false } },
    account: {
      accountLinking: {
        // Linking happens only through an explicit signed-in linkSocial() call,
        // never because two providers report the same email.
        enabled: true,
        disableImplicitLinking: true,
        trustedProviders: [],
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        updateUserInfoOnLink: false,
      },
    },
    logger: { disabled: true },
  };
}

let instance: ReturnType<typeof betterAuth> | undefined;

/** Create the server-only auth service on first use.
 * @returns Shared database-backed auth service; throws when accounts are not configured.
 * @example const session = await getAuth().api.getSession({ headers: request.headers })
 */
export function getAuth(): ReturnType<typeof betterAuth> {
  if (instance) return instance;
  if (!accountsEnabled())
    throw new Error("Account sign-in is not configured on this deployment.");
  instance = betterAuth(authOptions());
  return instance;
}
