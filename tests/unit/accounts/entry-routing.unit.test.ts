import { describe, expect, it } from "vitest";

import { entryRedirect } from "@/lib/account/entry-redirect";
import { authPagePath, safeReturnPath } from "@/lib/account/return-path";
import {
  destinationFromUrl,
  destinationUrl,
  parseDestination,
} from "@/lib/career/navigation";

const at = (path: string) => new URL(path, "https://verso.test");

describe("workspace URLs", () => {
  it("reads destinations from /app paths and legacy scope queries", () => {
    expect(destinationFromUrl(at("/app"))).toBe("overview");
    expect(destinationFromUrl(at("/app/"))).toBe("overview");
    expect(destinationFromUrl(at("/app/settings/account?connection=x"))).toBe(
      "settings/account",
    );
    expect(destinationFromUrl(at("/app/resume-content/r_1/"))).toBe(
      "resume-content/r_1",
    );
    expect(destinationFromUrl(at("/app?scope=backups"))).toBe("backups");
  });

  it("writes canonical paths, keeping unrelated parameters", () => {
    const url = destinationUrl(
      at("/app?scope=backups&connection=success"),
      parseDestination("backups"),
    );
    expect(`${url.pathname}${url.search}`).toBe(
      "/app/settings/data?connection=success",
    );
    expect(destinationUrl(at("/app/resumes"), "overview").pathname).toBe(
      "/app",
    );
  });
});

describe("sign-in return paths", () => {
  it("keeps only same-origin workspace destinations", () => {
    expect(safeReturnPath("/app/resumes?x=1")).toBe("/app/resumes?x=1");
    expect(safeReturnPath("/app")).toBe("/app");
    for (const unsafe of [
      null,
      "",
      "/",
      "/sign-in",
      "/application",
      "//evil.example/app",
      "/\evil.example",
      "https://evil.example/app",
      "/api/account",
    ])
      expect(safeReturnPath(unsafe)).toBe("/app");
  });

  it("carries the intended destination to auth pages", () => {
    expect(authPagePath("sign-in", "/app")).toBe("/sign-in");
    expect(authPagePath("sign-up", "/app/resumes/r1?tab=x")).toBe(
      "/sign-up?next=%2Fapp%2Fresumes%2Fr1%3Ftab%3Dx",
    );
    expect(authPagePath("sign-in", "https://evil.example")).toBe("/sign-in");
  });
});

describe("entry redirects", () => {
  it("shows the welcome page to visitors without a session cookie, even with guest data", () => {
    expect(entryRedirect(at("/"), false)).toBeNull();
    expect(entryRedirect(at("/sign-in?next=/app/resumes"), false)).toBeNull();
  });

  it("sends visitors with a session cookie to the workspace or their destination", () => {
    expect(entryRedirect(at("/"), true)).toEqual({
      location: "/app",
      permanent: false,
    });
    expect(
      entryRedirect(at("/sign-up?next=%2Fapp%2Fresumes%2Fr1"), true),
    ).toEqual({ location: "/app/resumes/r1", permanent: false });
    expect(entryRedirect(at("/sign-in?next=//evil.example"), true)).toEqual({
      location: "/app",
      permanent: false,
    });
  });

  it("permanently redirects legacy workspace links to path destinations", () => {
    expect(entryRedirect(at("/?scope=settings%2Faccount"), false)).toEqual({
      location: "/app/settings/account",
      permanent: true,
    });
    expect(entryRedirect(at("/?scope=overview"), true)).toEqual({
      location: "/app",
      permanent: true,
    });
  });
});
