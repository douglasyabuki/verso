import { cn } from "cn";

import { BrandMark } from "@/components/brand/brand";

import {
  CareerRecord,
  frontendResume,
  ResumeSheet,
  resumeSources,
  systemsResume,
} from "./resume-example";
import { TailoringDemo } from "./tailoring-demo";

// The curves begin at the centers of the four source rows and meet the
// horizontal branch above the documents. The mobile layout folds that branch
// down beneath the record.
const sourceRoutes = [
  { id: "experience", path: "M0 74 H9 Q34 74 34 49 V38 Q34 13 60 13 H64" },
  { id: "project", path: "M0 126 H9 Q34 126 34 101 V38 Q34 13 60 13 H64" },
  { id: "achievement", path: "M0 178 H9 Q34 178 34 153 V38 Q34 13 60 13 H64" },
  { id: "education", path: "M0 230 H9 Q34 230 34 205 V38 Q34 13 60 13 H64" },
] as const;
const examples = [
  {
    id: "frontend",
    label: "Frontend resume",
    resume: frontendResume,
    desktop: "M0 13 H66 Q74 13 74 21 V32",
    mobile: "M150 0 V8 Q150 16 142 16 H82 Q71 16 71 27 V39",
  },
  {
    id: "systems",
    label: "Design systems resume",
    resume: systemsResume,
    desktop: "M0 13 H216 Q226 13 226 23 V32",
    mobile: "M150 0 V8 Q150 16 158 16 H218 Q229 16 229 27 V39",
  },
] as const;

type Flow = { id: (typeof examples)[number]["id"]; paths: string[] };

const sourceTraces = examples.map(({ id }) => ({
  id,
  paths: sourceRoutes
    .filter((route) => resumeSources[id].has(route.id))
    .map(({ path }) => path),
}));
const routeStyle =
  "pointer-events-none w-full overflow-visible fill-none stroke-primary";
const branchStyle = "absolute inset-x-0 top-0";

function FlowPaths({ traces }: { traces: Flow[] }) {
  const guides = new Set(traces.flatMap(({ paths }) => paths));

  return (
    <>
      <g className="opacity-25">
        {Array.from(guides, (path) => (
          <path key={path} d={path} />
        ))}
      </g>
      {traces.map(({ id, paths }) => (
        <g
          key={id}
          data-flow={id}
          className={cn(
            "hidden stroke-[1.5px]",
            // Animate only the visible group so a returning route replays.
            id === "frontend"
              ? "group-data-[example=frontend]/demo:inline motion-safe:group-data-[example=frontend]/demo:[&_path]:animate-welcome-trace"
              : "group-data-[example=systems]/demo:inline motion-safe:group-data-[example=systems]/demo:[&_path]:animate-welcome-trace",
          )}
        >
          {paths.map((path) => (
            <path key={path} d={path} pathLength="1" />
          ))}
        </g>
      ))}
    </>
  );
}

export function TailoringIllustration() {
  return (
    <TailoringDemo>
      <div
        id="welcome-diagram"
        className="bg-[radial-gradient(var(--welcome-desk-rule)_0.75px,transparent_0.75px)] bg-size-[14px_14px] px-[clamp(12px,1.75vw,24px)] py-[clamp(14px,2.2vw,30px)] [--diagram-columns:minmax(0,1fr)_clamp(34px,4.3vw,64px)_minmax(0,1.85fr)] welcome-compact:[--diagram-columns:minmax(0,1fr)]"
      >
        <div
          className="mb-3 grid grid-cols-(--diagram-columns) welcome-kicker text-muted-foreground"
          aria-hidden="true"
        >
          <span>Career record</span>
          <span className="col-start-3 welcome-compact:hidden">
            Independent resumes
          </span>
        </div>
        <div className="grid grid-cols-(--diagram-columns) items-start">
          <CareerRecord interactive />
          <svg
            aria-hidden="true"
            data-route="source"
            className={cn(
              routeStyle,
              "block h-64 [--flow-delay:var(--welcome-flow-start)] [--flow-duration:var(--welcome-source-duration)] welcome-compact:hidden",
            )}
            viewBox="0 0 64 256"
            preserveAspectRatio="none"
          >
            <FlowPaths traces={sourceTraces} />
          </svg>
          <div className="relative grid grid-cols-2 gap-[clamp(8px,1.3vw,18px)] pt-8 welcome-compact:pt-[39px]">
            <svg
              aria-hidden="true"
              data-route="desktop"
              className={cn(
                routeStyle,
                branchStyle,
                "block h-8 [--flow-delay:var(--welcome-branch-start)] [--flow-duration:var(--welcome-branch-duration)] welcome-compact:hidden",
              )}
              viewBox="0 0 300 32"
              preserveAspectRatio="none"
            >
              <FlowPaths
                traces={examples.map(({ id, desktop }) => ({
                  id,
                  paths: [desktop],
                }))}
              />
            </svg>
            <svg
              aria-hidden="true"
              data-route="mobile"
              className={cn(
                routeStyle,
                branchStyle,
                "hidden h-[39px] [--flow-delay:var(--welcome-flow-start)] [--flow-duration:var(--welcome-source-duration)] welcome-compact:block",
              )}
              viewBox="0 0 300 39"
              preserveAspectRatio="none"
            >
              <FlowPaths
                traces={examples.map(({ id, mobile }) => ({
                  id,
                  paths: [mobile],
                }))}
              />
            </svg>
            {examples.map(({ id, label, resume }) => (
              <figure
                key={id}
                className={cn(
                  "grid min-w-0 grid-rows-[1fr_auto] gap-[9px] [--document-surface:color-mix(in_oklab,var(--paper),var(--paper-ink)_12%)] motion-safe:translate-y-[var(--document-shift,0px)] motion-safe:transition-transform motion-safe:delay-[var(--document-delay,0ms)] motion-safe:duration-230 motion-safe:ease-welcome",
                  id === "frontend"
                    ? "group-data-[example=frontend]/demo:welcome-selected-paper"
                    : "[--paper-intro:475ms] [--type-intro:640ms] group-data-[example=systems]/demo:welcome-selected-paper",
                )}
                data-document={id}
              >
                <ResumeSheet resume={resume} variant="demo" />
                <figcaption className="text-[0.6875rem]/[1.35] font-[550] text-[color:var(--document-edge,var(--muted-foreground))] motion-safe:transition-colors motion-safe:delay-[var(--document-delay,0ms)] motion-safe:duration-230 motion-safe:ease-welcome">
                  {label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-h-[49px] items-center gap-2.5 border-t bg-card px-[clamp(12px,2vw,24px)] py-2 text-xs/[1.4] text-muted-foreground">
        <BrandMark className="size-4 flex-none text-primary" />
        <p>Two resumes from Alex Morgan’s fictional career record.</p>
      </div>
    </TailoringDemo>
  );
}
