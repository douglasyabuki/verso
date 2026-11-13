/**
 * Validate supported clickable links.
 * @param value URL.
 * @returns {string | undefined} An error or undefined, including for an empty optional value.
 * @example urlError("javascript:alert(1)")
 */
export function urlError(value: string): string | undefined {
  if (!value) return;
  if (/[\u0000-\u0020\\]/.test(value))
    return "Enter a link without spaces, line breaks, or backslashes.";
  try {
    const url = new URL(value);
    if (!["https:", "http:", "mailto:", "tel:"].includes(url.protocol))
      return "Use https, http, mailto, or tel links.";
    if (
      (url.protocol === "mailto:" || url.protocol === "tel:") &&
      !url.pathname
    )
      return "Add an email address or phone number.";
    if (url.username || url.password)
      return "Remove the username or password from this link.";
  } catch {
    return "Enter a complete link, such as https://example.com.";
  }
}
