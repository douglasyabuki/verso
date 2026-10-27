"use client";

import {
  ChevronDown,
  Download,
  FileArchive,
  FileCode,
  FileText,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { LanguageFlag } from "@/components/resume/language-flag";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import type { useWorkspaceExports } from "@/hooks/workspace/use-workspace-exports";
import type { Locale } from "@/types-and-constants/languages";
import type { ResumeDocument, Variant } from "@/types-and-constants/resume";

type WorkspaceHeaderProps = {
  document: ResumeDocument;
  variant: Variant;
  setVariantId: (id: string) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dirty: boolean;
  exporting: boolean;
  runExport: ReturnType<typeof useWorkspaceExports>["runExport"];
  hasErrors: boolean;
  hasBilingualErrors: boolean;
};

export function WorkspaceResumeControls({
  document,
  variant,
  setVariantId,
  locale,
  setLocale,
  dirty,
  exporting,
  runExport,
  hasErrors,
  hasBilingualErrors,
}: WorkspaceHeaderProps) {
  const resumeItems = document.variants.map((item) => ({
    value: item.id,
    label: item.name || "Untitled resume",
  }));
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">
        <Label htmlFor="variant-picker" className="sr-only">
          Active resume
        </Label>
        <Select
          items={resumeItems}
          value={variant.id}
          onValueChange={(value) => {
            if (value === null) return;
            setVariantId(value);
          }}
        >
          <SelectTrigger
            appearance="utility"
            id="variant-picker"
            className="w-48 max-w-full min-w-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {resumeItems.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <ToggleGroup
          value={[locale]}
          onValueChange={(values) => {
            if (values[0]) setLocale(values[0] as Locale);
          }}
          variant="outline"
          spacing={0}
          size="sm"
          aria-label="Resume language"
        >
          <ToggleGroupItem value="en-US">
            <LanguageFlag locale="en-US" ratio="1x1" rounded />
            EN
          </ToggleGroupItem>
          <ToggleGroupItem value="pt-BR">
            <LanguageFlag locale="pt-BR" ratio="1x1" rounded />
            PT
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {dirty
            ? "Changes since your last backup"
            : "No changes since your last backup"}{" "}
          · Draft version {document.revision}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="sm" disabled={exporting} />}
          >
            <Download data-icon="inline-start" />
            {exporting ? "Exporting…" : "Download"}
            <ChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={hasErrors}
                onClick={() => void runExport("pdf")}
              >
                <FileText aria-hidden="true" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={hasBilingualErrors}
                onClick={() => void runExport("both")}
              >
                <FileArchive aria-hidden="true" />
                Both languages (ZIP)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={hasErrors}
                onClick={() => void runExport("latex")}
              >
                <FileCode aria-hidden="true" />
                LaTeX + assets
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function WorkspaceHeader({
  context,
  ...toolbar
}: ComponentProps<typeof WorkspaceToolbar> & { context: ReactNode }) {
  return (
    <header
      className="shrink-0 border-b bg-card"
      aria-label="Workspace controls"
    >
      <WorkspaceToolbar {...toolbar} />
      <div className="min-w-0 border-t px-4 py-3 md:px-6">{context}</div>
    </header>
  );
}
