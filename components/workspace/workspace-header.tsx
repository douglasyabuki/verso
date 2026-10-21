"use client";

import {
  ChevronDown,
  Download,
  FileArchive,
  FileCode,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspaceSaveStatus } from "@/components/workspace/workspace-toolbar";
import type { useWorkspaceExports } from "@/hooks/workspace/use-workspace-exports";
import type {
  Locale,
  ResumeDocument,
  Variant,
} from "@/types-and-constants/resume";

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

export function WorkspaceHeader({
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
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <label htmlFor="variant-picker" className="sr-only">
          Active resume variant
        </label>
        <NativeSelect
          id="variant-picker"
          className="max-w-48"
          value={variant.id}
          onChange={(event) => setVariantId(event.target.value)}
        >
          {document.variants.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.name || "Untitled variant"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
          <ToggleGroupItem value="en-US">EN</ToggleGroupItem>
          <ToggleGroupItem value="pt-BR">PT</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {dirty ? "Changes since JSON backup" : "Matches JSON backup"} · Draft
          r{document.revision}
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
      <WorkspaceSaveStatus className="text-xs text-muted-foreground sm:hidden" />
    </div>
  );
}
