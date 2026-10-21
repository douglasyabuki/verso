/** Validate certification dates using the intervals represented by their supplied precision.
 * @param issued Optional issue year or year-month.
 * @param expirationKind Unspecified, never, or date.
 * @param expires Expiration year or year-month when a date is selected.
 * @returns Field errors; overlapping partial-date intervals are accepted.
 * @example certificationDateErrors("2024-12", "date", "2024") // {}
 */
export function certificationDateErrors(
  issued: string,
  expirationKind: string,
  expires = "",
): { issued?: string; expiration?: string } {
  const pattern = /^(19|20|21|22)\d{2}(-(0[1-9]|1[0-2]))?$/;
  const errors: { issued?: string; expiration?: string } = {};
  const message = "Use YYYY or YYYY-MM, between 1900 and 2299.";
  if (issued && !pattern.test(issued)) errors.issued = message;
  if (expirationKind === "date") {
    if (!expires)
      errors.expiration =
        "Enter an expiration date or choose another expiration status.";
    else if (!pattern.test(expires)) errors.expiration = message;
    else if (issued && !errors.issued) {
      const earliestIssue = issued.length === 4 ? issued + "-01" : issued;
      const latestExpiration = expires.length === 4 ? expires + "-12" : expires;
      if (latestExpiration < earliestIssue)
        errors.expiration = "Expiration must not precede the issue date.";
    }
  }
  return errors;
}
