"use client";

import { useEffect, useState } from "react";

import { localized } from "@/lib/wording/localization";
import type { WorkspaceController } from "@/stores/workspace/controller";
import type { Locale } from "@/types-and-constants/languages";
import type {
  CareerEditorContext,
  WorkspaceDestination,
} from "@/types-and-constants/navigation";
import type {
  ResumeDocument,
  Section,
  Variant,
} from "@/types-and-constants/resume";
import type { ReviewReturnContext } from "@/types-and-constants/review";
import { defaultSectionIcons } from "@/types-and-constants/sections";

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
    kind: "career-overview",
  });
  const [variantId, selectVariant] = useState(document.variants[0].id);
  const [locale, setLocale] = useState<Locale>("en-US");
  const [careerLocale, setCareerLocale] = useState<Locale>("en-US");
  const [mobilePanel, setMobilePanel] = useState("editor");
  const [careerContexts, setCareerContexts] = useState<
    Record<string, CareerEditorContext>
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
      : selected.kind === "career-section" &&
          !document.sections.some((item) => item.id === selected.sectionId)
        ? { kind: "career-overview" }
        : selected;
  const variant =
    document.variants.find(
      (item) =>
        item.id ===
        (destination.kind === "resume" ? destination.resumeId : variantId),
    ) ?? document.variants[0];
  useEffect(() => {
    controller.endEditGroup();
  }, [controller, selected, locale, careerLocale]);
  const open = (next: WorkspaceDestination, excursion = false) => {
    if (blocked || !controller.commitEditorDrafts()) return focusToken;
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
              outputResumeId: variant.id,
              current: null,
              filters: {
                owner: "all",
                language: "all",
                section: "all",
                reason: "all",
                output: "selected",
                archive: "active",
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
    destination.kind === "career-section" ? destination.sectionId : "profile";
  const view =
    destination.kind === "career-profile"
      ? "profile"
      : destination.kind === "career-summary"
        ? destination.tab === "edit"
          ? "summary"
          : "career-translations"
        : destination.kind === "career-section"
          ? destination.tab === "edit"
            ? "content"
            : "career-translations"
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
    if (
      blocked ||
      !controller.commitEditorDrafts() ||
      document.sections.length >= 30
    )
      return;
    const id = crypto.randomUUID();
    const section: Section = {
      id,
      kind: "custom",
      icon: defaultSectionIcons.custom,
      heading: localized("Custom section", "Seção personalizada"),
      entries: [],
    };
    controller.edit((draft) => {
      draft.sections.push(section);
      draft.variants.forEach((variant) =>
        variant.sections.push({ sectionId: id, visible: true, entries: [] }),
      );
    });
    open({ kind: "career-section", sectionId: id, tab: "edit" });
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
    if (
      blocked ||
      !controller.commitEditorDrafts() ||
      document.variants.length >= 30
    )
      return;
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
      if (blocked || !controller.commitEditorDrafts()) return;
      selectVariant(id);
      if (destination.kind === "resume") open({ ...destination, resumeId: id });
    },
    locale,
    setLocale: (next: Locale | ((current: Locale) => Locale)) => {
      if (!blocked && controller.commitEditorDrafts()) setLocale(next);
    },
    careerLocale,
    setCareerLocale: (next: Locale | ((current: Locale) => Locale)) => {
      if (!blocked && controller.commitEditorDrafts()) setCareerLocale(next);
    },
    mobilePanel,
    setMobilePanel: (next: string) => {
      if (!blocked && controller.commitEditorDrafts()) setMobilePanel(next);
    },
    careerContexts,
    setCareerContexts,
    reviewContext,
    setReviewContext,
    scopedReviews,
    setScopedReviews,
    returnDestination,
    setReturnDestination,
  };
}
