import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getAuth } from "@/lib/account/auth";
import { createCareerDocument } from "@/lib/career/model";
import { PrismaClient } from "@/lib/generated/prisma/client";
import {
  startTestDatabase,
  type TestDatabase,
} from "@/tests/support/db/database";

type AuthProvider = "google" | "github";

vi.mock("server-only", () => ({}));

const origin = "http://localhost:3000";
let database: TestDatabase;
const document = createCareerDocument();
let prisma: PrismaClient;
let google = { id: "google-1", email: "same@example.test", verified: true };
let github = {
  id: 100,
  email: null as string | null,
  emails: [{ email: "same@example.test", primary: true, verified: true }],
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  vi.stubEnv("DATABASE_URL", "postgresql://isolated-test-database");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "isolated-social-test-secret-at-least-thirty-two-characters",
  );
  for (const provider of ["GOOGLE", "GITHUB"]) {
    vi.stubEnv(`${provider}_CLIENT_ID`, `isolated-${provider}-client`);
    vi.stubEnv(`${provider}_CLIENT_SECRET`, `isolated-${provider}-secret`);
  }
  const providers = (await getAuth().$context).socialProviders;
  const googleProvider = providers.find(
    (provider) => provider.id === "google",
  )!;
  vi.spyOn(googleProvider, "validateAuthorizationCode").mockResolvedValue({
    accessToken: "google-token",
  });
  vi.spyOn(googleProvider, "getUserInfo").mockImplementation(async () => ({
    user: {
      name: "Google name",
      email: google.email,
      emailVerified: google.verified,
    },
    data: {
      sub: google.id,
      email: google.email,
      email_verified: google.verified,
    },
  }));
  // GitHub token exchange and email resolution remain the installed provider's real code.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://github.com/login/oauth/access_token")
      return Response.json({
        access_token: "github-token",
        token_type: "bearer",
        expires_in: 28800,
        refresh_token: "github-refresh",
        refresh_token_expires_in: 15724800,
        scope: "read:user,user:email",
      });
    if (url === "https://api.github.com/user")
      return Response.json({
        id: github.id,
        login: "github-user",
        name: "GitHub name",
        email: github.email,
        avatar_url: "https://example.test/avatar",
      });
    if (url === "https://api.github.com/user/emails")
      return Response.json(github.emails);
    throw new Error(`Unexpected external request: ${url}`);
  });
}, 60000);

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.verification.deleteMany();
  google = { id: "google-1", email: "same@example.test", verified: true };
  github = {
    id: 100,
    email: null,
    emails: [{ email: "same@example.test", primary: true, verified: true }],
  };
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await database?.close();
});

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function post(path: string, body: object, cookie = "") {
  return POST(
    new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin, cookie },
      body: JSON.stringify(body),
    }),
  );
}

async function begin(provider: AuthProvider, cookie = "", signUp = true) {
  const response = await post(
    cookie ? "link-social" : "sign-in/social",
    {
      provider,
      callbackURL: "/app",
      errorCallbackURL: "/sign-in",
      ...(signUp && !cookie ? { requestSignUp: true } : {}),
    },
    cookie,
  );
  expect(response.status).toBe(200);
  const url = new URL((await response.json()).url);
  expect(url.searchParams.get("redirect_uri")).toBe(
    `${origin}/api/auth/callback/${provider}`,
  );
  const jar = new Map<string, string>();
  for (const part of [cookie, cookies(response)].join("; ").split("; ")) {
    const separator = part.indexOf("=");
    if (separator >= 0)
      jar.set(part.slice(0, separator), part.slice(separator + 1));
  }
  return {
    state: url.searchParams.get("state")!,
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

async function finish(
  provider: AuthProvider,
  flow: Awaited<ReturnType<typeof begin>>,
  suffix = "code=isolated-code",
) {
  return GET(
    new Request(
      `${origin}/api/auth/callback/${provider}?${suffix}&state=${flow.state}`,
      { headers: { cookie: flow.cookie } },
    ),
  );
}

async function signIn(provider: AuthProvider, signUp = true) {
  const response = await finish(provider, await begin(provider, "", signUp));
  expect(response.headers.get("Location")).toBe("/app");
  const cookie = cookies(response);
  expect(cookie).toContain("better-auth.session_token=");
  const session = await GET(
    new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
  );
  return {
    cookie,
    user: (await session.json()).user as {
      id: string;
      name: string;
      email: string;
    },
  };
}

for (const [first, second] of [
  ["google", "github"],
  ["github", "google"],
] as const) {
  test(`${first} → ${second} links the same verified resolved email and preserves workspace`, async () => {
    const original = await signIn(first);
    await prisma.accountWorkspace.create({
      data: {
        userId: original.user.id,
        document,
        workspaceId: "oauth-test-workspace",
        generation: 0,
        revision: 1,
      },
    });
    expect((await post("sign-out", {}, original.cookie)).status).toBe(200);
    // Sign-in (not sign-up) with the other provider links to the existing account.
    const linked = await signIn(second, false);
    expect(linked.user.id).toBe(original.user.id);
    expect(linked.user.name).toBe(original.user.name);
    expect(await prisma.account.count()).toBe(2);
    expect(
      (
        await prisma.accountWorkspace.findUnique({
          where: { userId: linked.user.id },
        })
      )?.document,
    ).toEqual(document);
    expect((await signIn(second, false)).user.id).toBe(original.user.id);
  });

  test(`${first} → ${second} does not match a secondary GitHub email`, async () => {
    github.emails = [
      { email: "github-primary@example.test", primary: true, verified: true },
      { email: google.email, primary: false, verified: true },
    ];
    const original = await signIn(first);
    await post("sign-out", {}, original.cookie);
    expect((await signIn(second)).user.id).not.toBe(original.user.id);
    expect(await prisma.user.count()).toBe(2);
  });
}

test("GitHub private email resolves through /user/emails and expiration data is persisted", async () => {
  const original = await signIn("google");
  await post("sign-out", {}, original.cookie);
  const linked = await signIn("github");
  expect(linked.user.id).toBe(original.user.id);
  const account = await prisma.account.findFirstOrThrow({
    where: { providerId: "github" },
  });
  expect(account.refreshToken).toBe("github-refresh");
  expect(account.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  expect(account.refreshTokenExpiresAt!.getTime()).toBeGreaterThan(
    account.accessTokenExpiresAt!.getTime(),
  );
});

for (const provider of ["google", "github"] as const) {
  test(`${provider} refuses to link an unverified provider email`, async () => {
    const original = await signIn(provider === "google" ? "github" : "google");
    if (provider === "google") google.verified = false;
    else
      github.emails = [{ email: google.email, primary: true, verified: false }];
    await post("sign-out", {}, original.cookie);
    const sessionsBefore = await prisma.session.count();
    const response = await finish(provider, await begin(provider));
    expect(response.headers.get("Location")).toMatch(
      /error=(unable_to_link_account|account_not_linked|email_not_verified)/,
    );
    expect(await prisma.account.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
    expect(cookies(response)).not.toContain("better-auth.session_token=");
    expect(await prisma.session.count()).toBe(sessionsBefore);
  });
}

test("automatic linking rejects an existing unverified local email and neither provider is trusted", async () => {
  const original = await signIn("google");
  await prisma.user.update({
    where: { id: original.user.id },
    data: { emailVerified: false },
  });
  await post("sign-out", {}, original.cookie);
  const response = await finish("github", await begin("github"));
  expect(response.headers.get("Location")).toContain("error=");
  expect(await prisma.account.count()).toBe(1);
  expect((await getAuth().$context).trustedProviders).toEqual([]);
});

test("sign-in without a matching account is refused instead of creating one", async () => {
  const response = await finish("google", await begin("google", "", false));
  expect(new URL(response.headers.get("Location")!, origin).pathname).toBe(
    "/sign-in",
  );
  expect(response.headers.get("Location")).toContain("error=signup_disabled");
  expect(await prisma.user.count()).toBe(0);
  expect(cookies(response)).not.toContain("better-auth.session_token=");
});
