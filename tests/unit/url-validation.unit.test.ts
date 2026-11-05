import { expect, it } from "vitest";

import { urlError } from "@/lib/url-validation";

it("preserves the shared editor's optional-link and safe-protocol rules outside retired review state", () => {
  for (const value of [
    "",
    "https://example.com/path",
    "http://example.com",
    "mailto:ana@example.com",
    "tel:+5511999999999",
  ])
    expect(urlError(value)).toBeUndefined();
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://user:password@example.com",
    "https://example.com/a b",
    "https://example.com\\path",
    "mailto:",
    "tel:",
    "example.com",
  ])
    expect(urlError(value)).toEqual(expect.any(String));
});
