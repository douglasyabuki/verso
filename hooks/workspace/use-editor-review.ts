"use client";

import type { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";
import type { Locale } from "@/types-and-constants/languages";
import type { WorkspaceDestination } from "@/types-and-constants/navigation";
import type { ReviewReturnContext } from "@/types-and-constants/review";

type EditorReviewOptions = Pick<
  ReturnType<typeof useWorkspaceEditor>,
  | "document"
  | "navigation"
  | "view"
  | "sectionId"
  | "variant"
  | "locale"
  | "career"
  | "summary"
  | "disabled"
>;

/** Derive editor review context and coordinate updates to navigation-owned state.
 * @param options Current editor selection and the sole navigation/review owner.
 * @returns Effective context and scoped review/tab actions; owns no review state.
 * @example const review = useEditorReview(editor);
 */
export function useEditorReview({
  document,
  navigation,
  view,
  sectionId,
  variant,
  locale,
  career,
  summary,
  disabled,
}: EditorReviewOptions) {
  const reviewKey = career ? sectionId : variant.id;
  const defaultContext: ReviewReturnContext = {
    outputResumeId: variant.id,
    current: null,
    filters: {
      owner: "all",
      language: locale,
      section: "all",
      reason: "all",
      output: view === "resume-translations" ? "selected" : "all",
      archive: "active",
    },
    scroll: 0,
  };
  const scopedContext = navigation.scopedReviews[reviewKey] ?? defaultContext;
  const reviewContext =
    view === "review"
      ? (navigation.reviewContext ?? defaultContext)
      : navigation.reviewContext
        ? { ...scopedContext, current: navigation.reviewContext.current }
        : scopedContext;
  const changeReviewContext = (context: ReviewReturnContext) => {
    if (view === "review") navigation.setReviewContext(context);
    else {
      navigation.setScopedReviews((current) => ({
        ...current,
        [reviewKey]: context,
      }));
      if (navigation.reviewContext)
        navigation.setReviewContext({
          ...navigation.reviewContext,
          current: context.current,
        });
    }
    if (
      view === "career-translations" &&
      context.current &&
      context.current !== reviewContext.current
    ) {
      const target = context.current;
      const entry = document.sections
        .find((section) => section.id === sectionId)
        ?.entries.find(
          (entry) =>
            target.path === `entries.${entry.id}.title` ||
            entry.bullets.some(
              (bullet) => target.path === `bullets.${bullet.id}.body`,
            ),
        );
      if (entry)
        navigation.setCareerContexts((current) => ({
          ...current,
          [sectionId]: {
            entryId: entry.id,
            query: "",
            showArchived: current[sectionId]?.showArchived || entry.archived,
          },
        }));
    }
  };

  const changeTab = (value: string) => {
    if (
      !disabled &&
      (value === "edit" || value === "review") &&
      (navigation.destination.kind === "career-section" ||
        navigation.destination.kind === "career-summary") &&
      value !== navigation.destination.tab
    ) {
      const token = navigation.open(
        {
          ...navigation.destination,
          tab: value,
        },
        true,
      );
      if (token === navigation.focusToken) return;
      if (
        value === "review" &&
        !navigation.reviewContext &&
        !navigation.scopedReviews[sectionId]
      ) {
        const entry = summary
          ? undefined
          : navigation.careerContexts[sectionId]?.entryId ||
            document.sections
              .find((section) => section.id === sectionId)
              ?.entries.find((entry) => !entry.archived)?.id;
        navigation.setScopedReviews((current) => ({
          ...current,
          [sectionId]: {
            ...defaultContext,
            current: {
              path: entry
                ? `entries.${entry}.title`
                : summary
                  ? "profile.summary"
                  : `sections.${sectionId}.heading`,
              locale,
            },
          },
        }));
      }
      if (value === "edit" && reviewContext.current)
        navigation.setCareerLocale(reviewContext.current.locale);
    }
  };
  const openReview = (
    destination: Extract<
      WorkspaceDestination,
      { kind: "career-summary" | "career-section" }
    >,
    locale: Locale,
  ) => {
    const sectionId =
      destination.kind === "career-summary" ? "profile" : destination.sectionId;
    navigation.setCareerLocale(locale);
    navigation.open(destination);
    navigation.setScopedReviews((current) => ({
      ...current,
      [sectionId]: {
        ...defaultContext,
        filters: { ...defaultContext.filters, language: locale },
      },
    }));
  };
  return { reviewContext, changeReviewContext, changeTab, openReview };
}
