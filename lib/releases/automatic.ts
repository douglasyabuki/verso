import type { PublicLinkSummary } from "@/types-and-constants/releases";

/** Inputs for deciding whether the visible tab should publish automatically. */
export type AutomaticReleaseInput = {
  /** Owner storage mode; automatic release exists only for acknowledged account Saves. */
  accountMode: boolean;
  /** Link for the previewed resume, if any. */
  link: PublicLinkSummary | undefined;
  /** Identity of the current committed preview output, when it matches the committed target. */
  output:
    { resumeId: string; generation: number; fingerprint: string } | undefined;
  /** Committed workspace generation. */
  generation: number;
  /** Output keys already attempted in this tab, so failures are never replayed blindly. */
  attempted: ReadonlySet<string>;
};

/** Stable key for one automatic release attempt.
 * @param linkId Public link identity.
 * @param output Committed output identity.
 * @returns {string} Key distinguishing link, generation, and fingerprint.
 * @example automaticReleaseKey(link.id, output)
 */
export function automaticReleaseKey(
  linkId: string,
  output: { generation: number; fingerprint: string },
): string {
  return `${linkId}:${output.generation}:${output.fingerprint}`;
}

/** Decide whether a committed preview should be released automatically.
 * Requires an account, an opted-in link for the same resume, a current output for
 * the committed generation, a fingerprint different from the latest release, and
 * no earlier attempt for the same output in this tab.
 * @param input Current tab state.
 * @returns {boolean} True when an automatic release should be sent now.
 * @example if (shouldReleaseAutomatically(input)) void store.release(...)
 */
export function shouldReleaseAutomatically(
  input: AutomaticReleaseInput,
): boolean {
  const { link, output } = input;
  if (!input.accountMode || !link?.autoRelease || !output) return false;
  if (output.resumeId !== link.resumeId) return false;
  if (output.generation !== input.generation) return false;
  const latest = link.releases.find(
    (release) => release.id === link.latestReleaseId,
  );
  if (
    latest &&
    latest.generation === output.generation &&
    latest.fingerprint === output.fingerprint
  )
    return false;
  return !input.attempted.has(automaticReleaseKey(link.id, output));
}
