"use client";

import { useCallback, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import type { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import { localizedFields } from "@/lib/wording/localization";
import {
  resolveIssueDestination,
  resolveOwnerDestination,
} from "@/lib/workspace/destinations";
import type { Locale } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { IssueNavigation } from "@/types-and-constants/navigation";
import type { Issue } from "@/types-and-constants/review";

type WorkspaceIssueNavigationOptions = {
  navigation: ReturnType<typeof useWorkspaceNavigation>;
};

/** Coordinate issue focus and owner-editor excursions without owning review state.
 * @param options Navigation owner, including its review and return destinations.
 * @returns Guarded focus requests, issue-panel visibility, and navigation actions.
 * @example const issues = useWorkspaceIssueNavigation({ navigation });
 */
export function useWorkspaceIssueNavigation({
  navigation,
}: WorkspaceIssueNavigationOptions) {
  const { state, controller } = useWorkspace();
  const { document } = state;
  const {
    variant,
    setVariantId: changeVariant,
    setLocale: changeLocale,
  } = navigation;
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issueNavigation, setIssueNavigation] = useState<
    IssueNavigation & {
      epoch: number;
      variantId: string;
      navigationToken: string;
    }
  >();
  const setVariantId = (id: string) => {
    setIssueNavigation((current) =>
      current ? { ...current, pending: false } : current,
    );
    changeVariant(id);
  };
  const setLocale: typeof changeLocale = (next) => {
    setIssueNavigation((current) =>
      current ? { ...current, pending: false } : current,
    );
    changeLocale(next);
  };
  const onIssueFocused = useCallback((id: string) => {
    setIssueNavigation((current) =>
      current?.id === id ? { ...current, pending: false } : current,
    );
  }, []);
  const onIssue = (issue: Issue) => {
    if (
      !issue.target ||
      state.replacing ||
      state.pending ||
      !controller.commitEditorDrafts()
    )
      return;
    const destination = resolveIssueDestination(document, issue, variant.id);
    if (!destination) return;
    if (
      destination.kind === "career-section" ||
      destination.kind === "career-summary"
    )
      navigation.setCareerLocale(issue.locale);
    else if (destination.kind === "resume") changeLocale(issue.locale);
    const navigationToken = navigation.open(destination);
    if (destination.kind === "career-section") {
      navigation.setCareerContexts((current) => ({
        ...current,
        [destination.sectionId]: {
          entryId: issue.target?.entryId ?? "",
          query: "",
          showArchived: !!issue.target?.entryId,
        },
      }));
    }
    setIssueNavigation({
      id: crypto.randomUUID(),
      issue,
      pending: true,
      epoch: state.textHistoryEpoch,
      variantId: issue.target.variantId ?? variant.id,
      navigationToken,
    });
    if (!desktop) setIssuesOpen(false);
  };
  const onOwner = (target: WorkspaceFocusTarget) => {
    if (!controller.commitEditorDrafts()) return;
    const field = localizedFields(document).find(
      (field) => field.path === target.path,
    );
    const destination = resolveOwnerDestination(document, target);
    if (!field || !destination) {
      navigation.open({ kind: "review" }, true);
      return;
    }
    const currentDestination = navigation.destination;
    if (!target.resumeId) navigation.setCareerLocale(target.locale);
    const entry = document.sections
      .flatMap((section) => section.entries)
      .find(
        (entry) =>
          target.path === `entries.${entry.id}.title` ||
          entry.bullets.some(
            (bullet) => target.path === `bullets.${bullet.id}.body`,
          ),
      );
    if (!target.resumeId)
      navigation.setCareerContexts((current) => ({
        ...current,
        [field.sectionId]: {
          entryId: entry?.id ?? "",
          query: "",
          showArchived: !!entry?.archived,
        },
      }));
    navigation.open(destination, true);
    if (!navigation.reviewContext)
      navigation.setScopedReviews((current) => ({
        ...current,
        [target.resumeId ?? field.sectionId]: {
          current: {
            path: target.path,
            locale: target.locale,
            resumeId: target.resumeId,
          },
          filters: {
            owner: "all",
            language: target.locale,
            section: "all",
            reason: "all",
            output: "all",
            archive: "active",
          },
          scroll: 0,
        },
      }));
    if (!navigation.reviewContext)
      navigation.setReturnDestination(currentDestination);
  };
  const editCareer = (path: string, targetLocale: Locale) => {
    const field = localizedFields(document).find(
      (field) => field.path === path,
    );
    if (!field) return;
    const entry = document.sections
      .flatMap((section) => section.entries)
      .find((entry) =>
        entry.bullets.some((bullet) => path === `bullets.${bullet.id}.body`),
      );
    const back = navigation.destination;
    navigation.setCareerContexts((current) => ({
      ...current,
      [field.sectionId]: {
        entryId: entry?.id ?? "",
        query: "",
        showArchived: !!entry?.archived,
      },
    }));
    navigation.setCareerLocale(targetLocale);
    const destination = resolveOwnerDestination(
      document,
      { path, locale: targetLocale },
      true,
    );
    if (destination) {
      const navigationToken = navigation.open(destination, true);
      setIssueNavigation({
        id: crypto.randomUUID(),
        pending: true,
        epoch: state.textHistoryEpoch,
        variantId: variant.id,
        navigationToken,
        issue: {
          id: path,
          path,
          message: "Edit shared career text",
          category: "translation",
          locale: targetLocale,
          section: field.source,
          entry: "",
          field: field.label,
          target: {
            sectionId: field.sectionId,
            entryId: entry?.id,
            fieldKey: `${path}.${targetLocale}`,
            scope: "shared",
          },
        },
      });
    }
    navigation.setReturnDestination(back);
  };

  const current =
    issueNavigation?.epoch === state.textHistoryEpoch &&
    issueNavigation.navigationToken === navigation.focusToken &&
    issueNavigation.variantId === variant.id
      ? issueNavigation
      : undefined;
  return {
    current,
    issuesOpen,
    setIssuesOpen,
    setVariantId,
    setLocale,
    onIssue,
    onOwner,
    editCareer,
    onIssueFocused,
    clear: () => setIssueNavigation(undefined),
    cancelFocus: () =>
      setIssueNavigation((current) =>
        current ? { ...current, pending: false } : current,
      ),
  };
}
