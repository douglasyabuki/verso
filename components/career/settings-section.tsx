import { type ReactNode, useId } from "react";

/** One titled group inside a Settings panel, matching the Account panel's section style.
 * @param props Heading, optional muted description, optional trailing header action, and content.
 * @returns Labelled section region whose accessible name is the heading.
 * @example <SettingsSection title="Back up" description="Download copies of your data.">…</SettingsSection>
 */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={id} className="font-medium">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
