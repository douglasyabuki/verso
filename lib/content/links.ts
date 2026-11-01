import type { ResumeLink } from "@/types-and-constants/resume";

/**
 * Resolve a shared link's destination, visible label and icon.
 * @param link Shared structured link.
 * @returns {{ address: string; label: string; type: ResumeLink["type"] }} Exact supplied address, trimmed label or address fallback, and selected icon type.
 * @example resolveLink(link)
 */
export function resolveLink(link: ResumeLink) {
  const address = link.url;
  return {
    address,
    label: link.label.trim() || address,
    type: link.type,
  };
}

/**
 * Name a link for organization without changing its printed display label.
 * @param link Shared structured link.
 * @param index Zero-based library position for an empty link fallback.
 * @returns {string} Internal name, resolved output label/address, or numbered link placeholder.
 * @example linkLabel(link, 0);
 */
export function linkLabel(link: ResumeLink, index: number): string {
  return (
    link.internalName?.trim() || resolveLink(link).label || `Link ${index + 1}`
  );
}
