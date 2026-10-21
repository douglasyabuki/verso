"use client";

import { useEffect, useState } from "react";

import { localized } from "@/lib/resume/localization";
import type { WorkspaceController } from "@/stores/workspace/controller";
import type {
  Locale,
  ResumeDocument,
  Section,
} from "@/types-and-constants/resume";

type WorkspaceNavigationOptions = {
  document: ResumeDocument;
  controller: WorkspaceController;
  blocked: boolean;
};

/** Coordinate workspace selections and section navigation without owning document state.
 * @param options Current document, its controller, and replacement blocking status.
 * @returns Tab-local selections, safe section/variant fallbacks, setters and navigation actions.
 * @example const navigation = useWorkspaceNavigation({ document, controller, blocked: !!state.pending });
 */
export function useWorkspaceNavigation({
  document,
  controller,
  blocked,
}: WorkspaceNavigationOptions) {
  const [view, setView] = useState("content");
  const [sectionId, setSectionId] = useState("profile");
  const [variantId, setVariantId] = useState("general");
  const [locale, setLocale] = useState<Locale>("en-US");
  const [mobilePanel, setMobilePanel] = useState("editor");
  useEffect(() => {
    controller.endEditGroup();
  }, [controller, view, sectionId, variantId, locale]);
  const activeSectionId =
    sectionId === "profile" ||
    document.sections.some((section) => section.id === sectionId)
      ? sectionId
      : "profile";
  const variant =
    document.variants.find((item) => item.id === variantId) ??
    document.variants[0];
  const navigate = (next: string, section?: string) => {
    controller.endEditGroup();
    setView(next);
    if (section) setSectionId(section);
    setMobilePanel("editor");
  };
  const addSection = () => {
    if (blocked) return;
    const id = crypto.randomUUID();
    const section: Section = {
      id,
      kind: "custom",
      heading: localized("Custom section", "Seção personalizada"),
      entries: [],
    };
    controller.edit((draft) => {
      draft.sections.push(section);
      draft.variants.forEach((variant) =>
        variant.sections.push({ sectionId: id, visible: true, entries: [] }),
      );
    });
    navigate("content", id);
  };
  return {
    view,
    activeSectionId,
    setSectionId,
    variant,
    setVariantId,
    locale,
    setLocale,
    mobilePanel,
    setMobilePanel,
    navigate,
    addSection,
  };
}
