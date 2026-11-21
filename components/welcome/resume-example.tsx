import { cn } from "cn";
import {
  Award,
  BriefcaseBusiness,
  CircleCheck,
  GraduationCap,
  PanelsTopLeft,
} from "lucide-react";
import type { CSSProperties } from "react";

const careerEntries = [
  {
    id: "experience",
    kind: "Experience",
    title: "Northstar Studio",
    Icon: BriefcaseBusiness,
  },
  {
    id: "project",
    kind: "Project",
    title: "Transit Companion",
    Icon: PanelsTopLeft,
  },
  {
    id: "achievement",
    kind: "Achievement",
    title: "Dashboard load time −35%",
    Icon: Award,
  },
  {
    id: "education",
    kind: "Education",
    title: "Software Engineering",
    Icon: GraduationCap,
  },
] as const;

type CareerEntryId = (typeof careerEntries)[number]["id"];

type ResumeExample = {
  language: "en-US" | "pt-BR";
  role: string;
  sections: {
    heading: string;
    entries: { source: CareerEntryId; title?: string; text: string }[];
  }[];
};

export const frontendResume: ResumeExample = {
  language: "en-US",
  role: "Frontend Engineer",
  sections: [
    {
      heading: "Experience",
      entries: [
        {
          source: "experience",
          title: "Northstar Studio",
          text: "2023–present",
        },
        {
          source: "achievement",
          text: "Cut dashboard load time by 35%.",
        },
      ],
    },
    {
      heading: "Education",
      entries: [
        {
          source: "education",
          title: "Software Engineering",
          text: "BSc · Example University",
        },
      ],
    },
  ],
};

export const systemsResume: ResumeExample = {
  language: "en-US",
  role: "Design Systems Engineer",
  sections: [
    {
      heading: "Selected project",
      entries: [
        {
          source: "project",
          title: "Transit Companion",
          text: "Designed a journey planner with accessible alerts.",
        },
      ],
    },
    {
      heading: "Experience",
      entries: [
        {
          source: "experience",
          title: "Northstar Studio",
          text: "Led a component library used by three teams.",
        },
      ],
    },
  ],
};

export const languageExamples: { label: string; resume: ResumeExample }[] = [
  {
    label: "English",
    resume: {
      language: "en-US",
      role: "Frontend Engineer",
      sections: [
        {
          heading: "Experience",
          entries: [
            {
              source: "experience",
              title: "Northstar Studio",
              text: "Mar 2023 – present",
            },
            {
              source: "achievement",
              text: "Led an accessible component library adopted by three product teams.",
            },
          ],
        },
      ],
    },
  },
  {
    label: "Português do Brasil",
    resume: {
      language: "pt-BR",
      role: "Engenheiro de Frontend",
      sections: [
        {
          heading: "Experiência",
          entries: [
            {
              source: "experience",
              title: "Northstar Studio",
              text: "Março de 2023 – atual",
            },
            {
              source: "achievement",
              text: "Liderei a criação de uma biblioteca de componentes acessíveis adotada por três equipes de produto.",
            },
          ],
        },
      ],
    },
  },
];

export const resumeSources = {
  frontend: new Set(
    frontendResume.sections.flatMap(({ entries }) =>
      entries.map(({ source }) => source),
    ),
  ),
  systems: new Set(
    systemsResume.sections.flatMap(({ entries }) =>
      entries.map(({ source }) => source),
    ),
  ),
};

export function CareerRecord({
  interactive = false,
}: {
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[8px] border bg-card",
        interactive && "shadow-(--welcome-shadow)",
      )}
    >
      <div className="flex min-h-[47px] flex-wrap content-center justify-between gap-x-2 gap-y-0.5 border-b px-2.5 py-[5px] text-xs font-semibold welcome-compact:min-h-9">
        <span>Career details</span>
        <span className="font-normal text-muted-foreground">Alex Morgan</span>
      </div>
      <ul
        className={
          interactive
            ? "pb-1 welcome-compact:grid welcome-compact:grid-cols-2 welcome-compact:pb-0"
            : "grid grid-cols-2 pb-1"
        }
      >
        {careerEntries.map(({ id, kind, title, Icon }, index) => (
          <li
            key={id}
            data-frontend={resumeSources.frontend.has(id) || undefined}
            data-systems={resumeSources.systems.has(id) || undefined}
            className={cn(
              "grid min-h-[52px] items-center gap-[7px] border-b px-[9px] py-1 leading-tight last:border-b-0 welcome-compact:gap-1 welcome-compact:px-[5px]",
              interactive
                ? "grid-cols-[16px_minmax(0,1fr)_12px] group-data-[example=frontend]/demo:data-frontend:welcome-selected-source group-data-[example=systems]/demo:data-systems:welcome-selected-source motion-safe:animate-welcome-record motion-safe:transition-colors motion-safe:duration-230 motion-safe:ease-welcome welcome-compact:odd:border-r welcome-compact:nth-last-2:border-b-0"
                : "grid-cols-[16px_minmax(0,1fr)] odd:border-r nth-last-2:border-b-0",
            )}
            style={
              interactive
                ? ({ "--entry-index": index } as CSSProperties)
                : undefined
            }
          >
            <Icon
              className="size-[15px] stroke-[1.6] text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-[0.6875rem] text-muted-foreground">{kind}</p>
              <p className="mt-0.5 text-xs/[1.25] font-[550] wrap-anywhere">
                {title}
              </p>
            </div>
            {interactive && (
              <CircleCheck
                className="size-3 text-primary opacity-[var(--source-check,0)] motion-safe:transition-opacity motion-safe:duration-180 motion-safe:ease-welcome"
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResumeSheet({
  resume,
  variant,
}: {
  resume: ResumeExample;
  variant: "demo" | "language" | "preview";
}) {
  const isDemo = variant === "demo";
  const isLanguage = variant === "language";

  return (
    <div
      className={cn(
        "min-w-0 border border-[color:var(--document-edge,var(--paper-rule))] bg-[var(--document-surface,var(--paper))] text-[color:var(--paper-ink)] shadow-(--welcome-shadow)",
        isLanguage
          ? "min-h-[178px] text-[length:clamp(0.75rem,1.1vw,0.875rem)]/[1.36]"
          : "text-[0.6875rem]/[1.36]",
        variant === "preview" && "mx-auto mt-4 w-[min(76%,244px)]",
        // The shared grid cell lets wrapped text exceed the A4 minimum height.
        isDemo &&
          "grid origin-top grid-cols-1 before:col-start-1 before:row-start-1 before:aspect-[210/297] before:w-full motion-safe:animate-welcome-paper motion-safe:transition-colors motion-safe:delay-[var(--document-delay,0ms)] motion-safe:duration-230 motion-safe:ease-welcome max-[361px]:text-[0.65625rem]/[1.3]",
      )}
      lang={resume.language}
    >
      <div
        className={cn(
          "min-w-0",
          isLanguage
            ? "p-[clamp(10px,2vw,24px)]"
            : "px-[clamp(9px,1.05vw,16px)] pt-[13px] pb-[18px]",
          isDemo &&
            "col-start-1 row-start-1 wrap-anywhere max-[361px]:px-[7px] max-[361px]:pt-[9px] max-[361px]:pb-3",
        )}
      >
        <div
          className={cn(
            "mb-[13px] text-(--paper-muted)",
            isDemo &&
              "relative before:absolute before:inset-y-0 before:-start-[5px] before:w-0.5 before:bg-[var(--document-indicator,transparent)] motion-safe:before:transition-colors motion-safe:before:delay-[var(--document-delay,0ms)] motion-safe:before:duration-230 motion-safe:before:ease-welcome max-[361px]:mb-2",
          )}
          data-paper-heading={isDemo || undefined}
        >
          <p
            className={cn(
              "mb-[3px] font-semibold tracking-[-0.05em] text-(--paper-ink)",
              isLanguage
                ? "text-[length:clamp(1.125rem,2.4vw,1.8rem)]/[1.05]"
                : "text-[length:clamp(0.975rem,1.4vw,1.35rem)]/[1.05]",
            )}
          >
            Alex Morgan
          </p>
          <p>{resume.role}</p>
        </div>
        {resume.sections.map(({ heading, entries }, index) => (
          <div
            className={cn(
              "nth-[n+3]:mt-2.5",
              isDemo && "motion-safe:animate-welcome-type",
            )}
            key={heading}
            style={{ "--section-index": index } as CSSProperties}
          >
            <p className="mb-[5px] border-b border-(--paper-rule) pb-0.5 font-[650] in-data-[document=systems]:text-(--paper-teal)">
              {heading}
            </p>
            {entries.map(({ source, title, text }) => (
              <div className="not-first-of-type:mt-1" key={source}>
                {title && <p className="font-semibold">{title}</p>}
                <p>{text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
