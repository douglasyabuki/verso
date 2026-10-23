"use client";

import { useEffect, useState } from "react";

import { localized } from "@/lib/resume/localization";
import type { WorkspaceController } from "@/stores/workspace/controller";
import type {
  LibraryEditorContext,
  ReviewReturnContext,
  WorkspaceDestination,
} from "@/types-and-constants/navigation";
import type {
  Locale,
  ResumeDocument,
  Section,
  Variant,
} from "@/types-and-constants/resume";

type WorkspaceNavigationOptions = {
  document: ResumeDocument;
  controller: WorkspaceController;
  blocked: boolean;
};

/** Keep destinations and return context outside the document and mounted compiler.
 * @param options Restored document, controller, and replacement guard.
 * @returns Typed navigation, safe stale-ID fallbacks, and transient editor context.
 * @example const navigation = useWorkspaceNavigation({ document, controller, blocked: false });
 */
export function useWorkspaceNavigation({
  document,
  controller,
  blocked,
}: WorkspaceNavigationOptions) {
  const [selected, setSelected] = useState<WorkspaceDestination>({
    kind: "library-overview",
  });
  const [variantId, selectVariant] = useState(document.variants[0].id);
  const [locale, setLocale] = useState<Locale>("en-US");
  const [libraryLocale, setLibraryLocale] = useState<Locale>("en-US");
  const [mobilePanel, setMobilePanel] = useState("editor");
  const [libraryContexts, setLibraryContexts] = useState<
    Record<string, LibraryEditorContext>
  >({});
  const [reviewContext, setReviewContext] =
    useState<ReviewReturnContext | null>(null);
  const [scopedReviews, setScopedReviews] = useState<
    Record<string, ReviewReturnContext>
  >({});
  const [returnDestination, setReturnDestination] =
    useState<WorkspaceDestination | null>(null);
  const [nameFocus, setNameFocus] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState("");
  const destination: WorkspaceDestination =
    selected.kind === "resume" &&
    !document.variants.some((item) => item.id === selected.resumeId)
      ? { kind: "resumes" }
      : selected.kind === "library-section" &&
          selected.sectionId !== "profile" &&
          !document.sections.some((item) => item.id === selected.sectionId)
        ? { kind: "library-overview" }
        : selected;
  const variant =
    document.variants.find(
      (item) =>
        item.id ===
        (destination.kind === "resume" ? destination.resumeId : variantId),
    ) ?? document.variants[0];
  useEffect(() => {
    controller.endEditGroup();
  }, [controller, selected, locale, libraryLocale]);
  const open = (next: WorkspaceDestination, excursion = false) => {
    const token = crypto.randomUUID();
    setFocusToken(token);
    controller.endEditGroup();
    if (!excursion) {
      setReturnDestination(null);
      setScopedReviews({});
      setNameFocus(null);
      setReviewContext(
        next.kind === "review"
          ? (reviewContext ?? {
              current: null,
              filters: {
                owner: "all",
                language: "all",
                section: "all",
                reason: "all",
                output: "all",
              },
              scroll: 0,
            })
          : null,
      );
    }
    if (next.kind === "resume") selectVariant(next.resumeId);
    setSelected(next);
    setMobilePanel("editor");
    return token;
  };
  const activeSectionId =
    destination.kind === "library-section" ? destination.sectionId : "profile";
  const view =
    destination.kind === "library-section"
      ? destination.tab === "edit"
        ? "content"
        : "library-translations"
      : destination.kind === "resume"
        ? (
            {
              content: "variants",
              translations: "resume-translations",
              layout: "template",
            } as const
          )[destination.page]
        : destination.kind;
  const addSection = () => {
    if (blocked || document.sections.length >= 30) return;
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
    open({ kind: "library-section", sectionId: id, tab: "edit" });
  };
  useEffect(() => {
    if (
      !nameFocus ||
      selected.kind !== "resume" ||
      selected.resumeId !== nameFocus ||
      selected.page !== "content"
    )
      return;
    const frame = requestAnimationFrame(() => {
      globalThis.document
        .querySelector<HTMLElement>(
          `[data-issue-field="variants.${CSS.escape(nameFocus)}.name"]`,
        )
        ?.focus();
      setNameFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [nameFocus, selected]);
  const createResume = (source?: Variant) => {
    if (blocked || document.variants.length >= 30) return;
    const id = crypto.randomUUID();
    const created: Variant = source
      ? {
          ...structuredClone(source),
          id,
          name: `${source.name || "Untitled"} copy`.slice(0, 100),
        }
      : {
          id,
          name: "New resume",
          color: "indigo",
          sections: document.sections.map((section) => ({
            sectionId: section.id,
            visible: true,
            entries: [],
          })),
          wording: { achievements: {} },
          settings: {},
          localeSettings: {},
        };
    controller.edit((draft) => {
      if (draft.variants.length < 30) draft.variants.push(created);
    });
    open({ kind: "resume", resumeId: id, page: "content" });
    setNameFocus(id);
  };
  return {
    destination,
    focusToken,
    open,
    view,
    activeSectionId,
    addSection,
    createResume,
    variant,
    setVariantId: (id: string) => {
      selectVariant(id);
      if (destination.kind === "resume") open({ ...destination, resumeId: id });
    },
    setSectionId: (id: string) =>
      open({ kind: "library-section", sectionId: id, tab: "edit" }),
    locale,
    setLocale,
    libraryLocale,
    setLibraryLocale,
    mobilePanel,
    setMobilePanel,
    libraryContexts,
    setLibraryContexts,
    reviewContext,
    setReviewContext,
    scopedReviews,
    setScopedReviews,
    returnDestination,
    setReturnDestination,
  };
}
