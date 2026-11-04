"use client";

import { Search, X } from "lucide-react";
import { useId, useRef } from "react";

import { CheckField } from "@/components/editor/fields";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

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
  const input = useRef<HTMLInputElement>(null);
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
        <InputGroup>
          <InputGroupInput
            ref={input}
            appearance="utility"
            id={id}
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Organization, title, technology, or achievement"
          />
          {query.length !== 0 && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search entries"
                onClick={() => {
                  onQuery("");
                  input.current?.focus();
                }}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
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
