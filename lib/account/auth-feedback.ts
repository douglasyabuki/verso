/** Map an OAuth callback code to safe recovery instructions.
 * @param code Untrusted callback error code; null means there was no failure.
 * @returns Safe feedback, or an empty string when there is no error.
 * @example authErrorMessage("account_not_linked")
 */
export function authErrorMessage(code: string | null): string {
  if (code === null) return "";
  switch (code.toLowerCase()) {
    case "account_not_linked":
    case "unable_to_link_account":
    case "email_not_verified":
      return "Could not connect this sign-in method. Verify your email with your provider, or sign in with your original provider and try again.";
    case "email_not_found":
      return "Your provider did not return an email. Add and verify an email with your provider, then try again.";
    case "access_denied":
      return "Sign-in was canceled or denied. Please try again when you are ready.";
    default:
      return "Sign-in was not completed. Please try again.";
  }
}
