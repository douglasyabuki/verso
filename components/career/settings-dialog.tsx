"use client";

import {
  Database,
  Languages,
  Palette,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { devicePreferencesSchema } from "@/lib/career/device-preferences";
import {
  type DevicePreferences,
  type SettingsPanel,
  settingsPanels,
} from "@/types-and-constants/settings";

const icons = [Palette, Languages, SlidersHorizontal, Database, Settings2];

/** Render immediate numeric preferences, retaining malformed input until corrected.
 * @param props Effective preferences and the owning persistence command.
 * @returns Advanced controls; Enter/blur applies valid values only.
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
    <div className="flex flex-col gap-5">
      <p>
        Save explicitly commits workspace changes. Draft recovery is separate.
        The PDF preview uses saved content only and refreshes manually by
        default.
      </p>
      <Field>
        <FieldLabel htmlFor="automatic-refresh">
          <Checkbox
            id="automatic-refresh"
            checked={Boolean(values.automaticRefresh)}
            aria-describedby="automatic-refresh-description"
            onCheckedChange={(checked) =>
              change({ automaticRefresh: Boolean(checked) })
            }
          />
          Refresh preview automatically after Save
        </FieldLabel>
        <FieldDescription id="automatic-refresh-description">
          Applies to this device only. The visible preview refreshes shortly
          after a Save changes the selected resume&apos;s PDF. Unsaved edits,
          preset loads, and resets never refresh it.
        </FieldDescription>
      </Field>
      <Collapsible>
        <CollapsibleTrigger
          render={<Button variant="outline" />}
          className={disclosureTriggerClassName}
        >
          <DisclosureChevron />
          <DisclosureLabel>Advanced settings</DisclosureLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <DisclosureGuide>
            <FieldGroup>
              {(
                [
                  [
                    "initializationTimeoutMs",
                    "Compiler initialization timeout (seconds)",
                    1000,
                  ],
                  [
                    "compilationTimeoutMs",
                    "Compilation timeout (seconds)",
                    1000,
                  ],
                  [
                    "completedOperationDays",
                    "Completed-operation retention (days)",
                    1,
                  ],
                  [
                    "completedOperationCount",
                    "Maximum retained completed operations",
                    1,
                  ],
                ] as const
              ).map(([name, label, divisor]) => (
                <PreferenceNumber
                  key={name}
                  name={name}
                  label={label}
                  divisor={divisor}
                  values={values}
                  change={change}
                />
              ))}
              <p className="text-xs text-muted-foreground">
                Timeouts affect the next compiler instance; active compilation
                is preserved. Completed receipts expire at the first age/count
                limit. Zero retains no eligible completed receipts. Pending,
                uncertain, unacknowledged, and recovery-referenced operations
                remain protected. Missing receipts require comparison before
                retry; unresolved recovery never expires automatically.
              </p>
            </FieldGroup>
          </DisclosureGuide>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Apply a numeric preference only after explicit Enter or blur validation.
 * @param props Effective field value and update command.
 * @returns An accessible input with retained invalid text and field feedback.
 * @example <PreferenceNumber name="completedOperationDays" label="Days" divisor={1} values={values} change={change} />
 */
function PreferenceNumber({
  name,
  label,
  divisor,
  values,
  change,
}: {
  name: Exclude<keyof DevicePreferences, "automaticRefresh">;
  label: string;
  divisor: number;
  values: DevicePreferences;
  change: (patch: Partial<DevicePreferences>) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  const apply = () => {
    if (text === null) return;
    const value = Number(text) * divisor;
    const parsed = devicePreferencesSchema.safeParse({
      ...values,
      [name]: text.trim() ? value : NaN,
    });
    if (!parsed.success) {
      setError(
        divisor === 1000
          ? "Enter seconds between 0.1 and 600."
          : "Enter a nonnegative safe whole number.",
      );
      return;
    }
    if (values[name] !== value) change({ [name]: value });
    setText(null);
    setError("");
  };
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={`device-${name}`}>{label}</FieldLabel>
      <Input
        id={`device-${name}`}
        inputMode="decimal"
        value={text ?? String(values[name] / divisor)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `error-${name}` : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
      />
      {error && <FieldError id={`error-${name}`}>{error}</FieldError>}
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
  workspaceSettings,
  preferenceStatus,
  retryPreferences,
  historyKey,
}: {
  panel: SettingsPanel | null;
  navigate: (destination: string) => void;
  close: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  workspaceSettings: boolean;
  preferenceStatus: string;
  retryPreferences: () => void;
  historyKey: number;
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
          Manage browser preferences, content languages, backups, and new-resume
          defaults.
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
                        {settingsPanels.map((item, index) => {
                          const Icon = icons[index];
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
                {panel === "data"
                  ? "Workspace backups contain saved content; recovery is separate."
                  : workspaceSettings
                    ? "Included in workspace backups. Changes require Save."
                    : "This browser. Device preferences apply immediately and are excluded from backups."}
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
                <FieldGroup>
                  <Field>
                    <FieldLabel>Application theme</FieldLabel>
                    <FieldDescription>
                      System follows your device. This changes the application
                      appearance; resume layout is separate.
                    </FieldDescription>
                    <ThemeSelector />
                  </Field>
                </FieldGroup>
              ) : (
                children
              )}
              {preferenceStatus && panel === "editing-preview" && (
                <div role="status">
                  <p>{preferenceStatus}</p>
                  {(preferenceStatus.includes("tab only") ||
                    preferenceStatus.includes("could not be loaded")) && (
                    <Button variant="outline" onClick={retryPreferences}>
                      Retry saving preferences
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Stored locally in this browser. Clearing or eviction can remove
                local data. Account sync is not available.
              </p>
            </div>
          </section>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
