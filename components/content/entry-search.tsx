"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import { CheckField } from "@/components/editor/fields";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";

export function EntrySearch({
  query,
  onQuery,
  showArchived,
  onArchived,
  count,
  total,
}: {
  query: string;
  onQuery: (value: string) => void;
  showArchived: boolean;
  onArchived: (value: boolean) => void;
  count: number;
  total: number;
}) {
  const id = useId();
  return (
    <FieldGroup className="gap-3">
      <Field>
        <div className="flex items-center gap-2">
          <FieldLabel htmlFor={id}>
            <Search className="size-4" aria-hidden="true" />
            Search entries
          </FieldLabel>
          <InfoHint label="entry search">
            Searches English and Portuguese, regardless of the editing language.
          </InfoHint>
        </div>
        <div className="flex items-center gap-2">
          <Input
            appearance="utility"
            id={id}
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Organization, title, technology, or achievement"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!query}
            onClick={() => onQuery("")}
          >
            <X data-icon="inline-start" />
            Clear
          </Button>
        </div>
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CheckField
          label="Include archived entries"
          checked={showArchived}
          onChange={onArchived}
        />
        <p className="text-xs text-muted-foreground" role="status">
          {count} of {total} entries
        </p>
      </div>
    </FieldGroup>
  );
}
