"use client";

import {
  Database,
  Globe,
  Languages,
  Palette,
  Settings2,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";

import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { SidebarSelection } from "@/components/ui/sidebar-selection";
import {
  type DevicePreferences,
  type SettingsPanel,
  settingsPanels,
} from "@/types-and-constants/settings";

const icons = {
  account: UserRound,
  appearance: Palette,
  data: Database,
  defaults: Settings2,
  languages: Languages,
  "editing-preview": SlidersHorizontal,
  releases: Globe,
} satisfies Record<SettingsPanel, unknown>;

const panelDescriptions: Record<SettingsPanel, string> = {
  account:
    "Sign-in for this browser. Signing in never moves or merges workspaces.",
  appearance: "How Verso looks in this browser. Applies immediately.",
  data: "Unsaved drafts, backups, and imports for this workspace.",
  defaults:
    "Appearance copied into new blank resumes. Existing resumes, presets, and starters keep their own. Changes require Save.",
  languages:
    "Languages your career content is written in. Changes require Save.",
  "editing-preview":
    "Preview behavior in this browser. Applies immediately and is excluded from backups.",
  releases: "Unlisted public links to released PDFs, stored in your account.",
};

/** Render the browser's automatic preview refresh preference.
 * @param props Current preference and the owning persistence command.
 * @returns An immediately applied toggle for committed PDF refreshes.
 * @example <DeviceSettings values={preferences} change={changePreferences} />
 */
export function DeviceSettings({
  values,
  change,
}: {
  values: DevicePreferences;
  change: (patch: Partial<DevicePreferences>) => void;
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox
        id="automatic-refresh"
        checked={values.automaticRefresh}
        onCheckedChange={(checked) =>
          change({ automaticRefresh: Boolean(checked) })
        }
      />
      <FieldContent>
        <FieldLabel htmlFor="automatic-refresh">
          Refresh preview automatically after Save
        </FieldLabel>
        <FieldDescription>
          Refreshes shortly after a Save changes the selected resume&apos;s PDF.
          The preview shows saved content only.
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}

/** Present durable Settings panels while keeping the underlying workspace mounted.
 * @param props Validated panel, guarded navigation/close actions, and active panel content.
 * @returns Responsive sidebar dialog with panel scroll restoration and focus return.
 * @example <SettingsDialog panel="data" navigate={navigate} close={close} returnFocus={trigger}>{data}</SettingsDialog>
 */
export function SettingsDialog({
  panel,
  navigate,
  close,
  returnFocus,
  children,
  preferenceStatus,
  retryPreferences,
  historyKey,
  accountMode = false,
}: {
  panel: SettingsPanel | null;
  navigate: (destination: string) => void;
  close: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  preferenceStatus: string;
  retryPreferences: () => void;
  historyKey: number;
  /** Signed-in workspace: saved content lives in the account, not this browser. */
  accountMode?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const views = useRef(new Map<number, { scroll: number; focusId?: string }>());
  useLayoutEffect(() => {
    if (!panel) return;
    const node = scroll.current;
    const savedViews = views.current;
    const remembered = savedViews.get(historyKey);
    if (node) node.scrollTop = remembered?.scroll ?? 0;
    const target = remembered?.focusId
      ? document.getElementById(remembered.focusId)
      : null;
    (target ?? heading.current)?.focus({ preventScroll: true });
  }, [panel, historyKey]);
  return (
    <Dialog
      open={panel !== null}
      onOpenChange={(open, details) => {
        if (open) return;
        details.cancel();
        if (
          details.event instanceof KeyboardEvent &&
          (details.event.isComposing || details.event.keyCode === 229)
        )
          return;
        close();
      }}
    >
      <DialogContent
        className="flex h-[min(760px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 data-[size=default]:max-w-5xl data-[size=default]:sm:max-w-5xl"
        initialFocus={heading}
        finalFocus={() =>
          returnFocus.current?.isConnected &&
          returnFocus.current.getClientRects().length > 0 &&
          !returnFocus.current.closest('[role="dialog"][data-closed]')
            ? returnFocus.current
            : document.querySelector<HTMLButtonElement>(
                '[data-sidebar="trigger"]',
              )
        }
      >
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <DialogTitle>Settings</DialogTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close settings"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <DialogDescription className="sr-only">
          Manage browser preferences, content languages, backups, new-resume
          defaults, and your account.
        </DialogDescription>
        <SidebarProvider
          keyboardShortcut={false}
          className="min-h-0 flex-1 flex-col overflow-hidden md:flex-row"
          style={{ "--sidebar-width": "200px" } as React.CSSProperties}
        >
          <Sidebar
            collapsible="none"
            className="h-auto w-full shrink-0 border-b md:h-full md:w-(--sidebar-width) md:border-e md:border-b-0"
          >
            <SidebarContent className="overflow-visible">
              <SidebarGroup>
                <SidebarGroupContent>
                  <nav aria-label="Settings panels">
                    <SidebarSelection>
                      <SidebarMenu className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:flex md:flex-col">
                        {settingsPanels.map((item) => {
                          const Icon = icons[item.id];
                          return (
                            <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                isActive={panel === item.id}
                                aria-current={
                                  panel === item.id ? "page" : undefined
                                }
                                aria-controls="settings-panel"
                                onClick={() => navigate(`settings/${item.id}`)}
                              >
                                <Icon aria-hidden="true" />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarSelection>
                  </nav>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <section
            id="settings-panel"
            aria-labelledby="settings-panel-heading"
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <header className="shrink-0 px-5 py-4">
              <h2
                ref={heading}
                tabIndex={-1}
                id="settings-panel-heading"
                className="text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {settingsPanels.find((item) => item.id === panel)?.label}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {panel ? panelDescriptions[panel] : null}
              </p>
            </header>
            <div
              ref={scroll}
              onScroll={(event) => {
                if (!panel) return;
                views.current.set(historyKey, {
                  ...views.current.get(historyKey),
                  scroll: event.currentTarget.scrollTop,
                });
              }}
              onFocusCapture={(event) => {
                if (
                  !panel ||
                  !(event.target instanceof HTMLElement) ||
                  !event.target.id
                )
                  return;
                views.current.set(historyKey, {
                  scroll: event.currentTarget.scrollTop,
                  focusId: event.target.id,
                });
              }}
              className="app-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 text-sm"
            >
              {panel === "appearance" ? (
                <Field>
                  <FieldLabel id="settings-theme-label">Theme</FieldLabel>
                  <FieldDescription>
                    System follows your device. Resume layout is set separately.
                  </FieldDescription>
                  <ThemeSelector labelled labelledBy="settings-theme-label" />
                </Field>
              ) : (
                children
              )}
              {preferenceStatus && panel === "editing-preview" && (
                <div
                  role="status"
                  className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                >
                  <p>{preferenceStatus}</p>
                  {(preferenceStatus.includes("tab only") ||
                    preferenceStatus.includes("could not be loaded")) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={retryPreferences}
                    >
                      Retry saving preferences
                    </Button>
                  )}
                </div>
              )}
              {panel === "data" && (
                <p className="text-xs text-muted-foreground">
                  {accountMode
                    ? "Saved content is stored in your account. Drafts and unconfirmed Saves stay in this browser until confirmed; clearing or eviction can remove them."
                    : "Stored locally in this browser. Clearing or eviction can remove local data."}
                </p>
              )}
            </div>
          </section>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
