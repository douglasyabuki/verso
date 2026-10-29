import { ContentStatusBadge } from "@/components/shared/semantic-badges/content-status-badge";
import { SelectionBadge } from "@/components/shared/semantic-badges/selection-badge";
import { Button } from "@/components/ui/button";

export function InclusionStatus({
  selected,
  archived,
  sectionVisible,
  count,
  total,
  variantName,
}: {
  selected: boolean;
  archived: boolean;
  sectionVisible: boolean;
  count?: number;
  total?: number;
  variantName: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={`Selection in ${variantName}`}
    >
      <SelectionBadge selected={selected} />
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">
          {count}/{total} selected
        </span>
      )}
      {archived && <ContentStatusBadge state="archived-omitted" />}
      {!archived && !sectionVisible && (
        <ContentStatusBadge state="section-hidden" />
      )}
    </div>
  );
}

export function AchievementSelectionActions({
  selected,
  total,
  disabled,
  onSelectAll,
  onClearAll,
  label,
  showCount = true,
}: {
  selected: number;
  total: number;
  disabled: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  label: string;
  showCount?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={`${label} selection`}
    >
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled || selected === total}
        onClick={onSelectAll}
      >
        Select all
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled || selected === 0}
        onClick={onClearAll}
      >
        Clear all
      </Button>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          {selected} of {total} selected
          {disabled ? " · Include an unarchived entry to change selection" : ""}
        </span>
      )}
    </div>
  );
}
