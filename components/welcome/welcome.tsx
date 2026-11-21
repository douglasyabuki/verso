import { cn } from "cn";
import {
  ArrowDown,
  ArrowRight,
  Check,
  FileText,
  GripVertical,
  Monitor,
  RefreshCw,
  SunMoon,
} from "lucide-react";
import Link from "next/link";

import { BrandLockup, BrandMark } from "@/components/brand/brand";
import { ThemeMenu } from "@/components/theme-selector";
import { Button, buttonVariants } from "@/components/ui/button";
import { workspaceBasePath } from "@/lib/career/navigation";

import {
  CareerRecord,
  frontendResume,
  languageExamples,
  ResumeSheet,
} from "./resume-example";
import { TailoringIllustration } from "./tailoring-illustration";

const actionSize =
  "min-h-11 px-4 motion-reduce:transition-none motion-reduce:active:translate-y-0";
const sectionIntro = "grid content-start gap-3";
const sectionTitle =
  "max-w-[19ch] text-[length:clamp(2.15rem,4.15vw,4rem)]/[1.04] font-medium tracking-[-0.06em] text-balance";
const sectionText =
  "max-w-[42ch] text-[length:clamp(1rem,1.6vw,1.1875rem)]/[1.55] text-pretty text-muted-foreground";
const note = "mt-2.5 text-[0.8125rem]/[1.5] text-pretty text-muted-foreground";
const twoColumnSection =
  "welcome-frame grid gap-[clamp(24px,7vw,100px)] min-[761px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]";
const closingPaper =
  "absolute aspect-[210/297] w-[64%] border border-input bg-(--welcome-editorial) shadow-(--welcome-shadow)";

function WelcomeAppearance() {
  return (
    <ThemeMenu
      trigger={
        <Button
          variant="ghost"
          className="min-h-10 min-w-10 justify-self-center motion-reduce:transition-none welcome-compact:px-0 welcome-compact:has-data-[icon=inline-start]:pl-0"
          aria-label="Appearance"
          title="Appearance"
        />
      }
    >
      <SunMoon aria-hidden="true" data-icon="inline-start" />
      <span className="welcome-compact:hidden">Appearance</span>
    </ThemeMenu>
  );
}

function EntryActions() {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link
        href={workspaceBasePath}
        prefetch={false}
        className={cn(buttonVariants({ size: "lg", className: actionSize }))}
      >
        Continue as guest
        <ArrowRight aria-hidden="true" data-icon="inline-end" />
      </Link>
      <Link
        href="/sign-up"
        className={cn(
          buttonVariants({
            variant: "outline",
            size: "lg",
            className: actionSize,
          }),
        )}
      >
        Create an account
      </Link>
    </div>
  );
}

function Workflow() {
  const step =
    "grid items-center gap-[clamp(16px,6vw,90px)] border-b py-[clamp(20px,3.4vw,44px)] min-[761px]:grid-cols-2 max-[761px]:gap-[18px]";
  const copy =
    "grid grid-cols-[29px_minmax(0,1fr)] gap-[clamp(8px,2.5vw,34px)]";
  const number = "welcome-kicker mt-2 text-primary";
  const title =
    "text-[length:clamp(1.35rem,2.5vw,2rem)]/[1.15] font-medium tracking-[-0.045em]";
  const description =
    "mt-2 max-w-[46ch] leading-[1.6] text-pretty text-muted-foreground";
  const visual =
    "w-full max-w-[430px] justify-self-start rounded-[8px] border min-[761px]:justify-self-center";
  const windowStyle = `${visual} overflow-clip text-[0.8125rem]/[1.3]`;
  const windowHeader =
    "flex flex-wrap justify-between gap-x-2.5 gap-y-1 border-b bg-card px-3.5 py-3 font-semibold";
  const composeRow =
    "grid min-h-[33px] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-[7px] rounded p-[5px]";
  const grip = "size-3.5 text-muted-foreground";
  const checkbox =
    "grid size-3.5 place-items-center rounded-[2px] border border-input has-[svg]:border-primary has-[svg]:bg-primary has-[svg]:text-primary-foreground";

  return (
    <section
      className="scroll-mt-4 border-y bg-card py-[clamp(50px,7vw,96px)]"
      id="tailoring"
      aria-labelledby="workflow-title"
    >
      <div className="welcome-frame">
        <div className={sectionIntro}>
          <p className="welcome-kicker text-primary">The workflow</p>
          <h2 className={sectionTitle} id="workflow-title">
            From career details to PDF.
          </h2>
        </div>
        <ol className="mt-[clamp(25px,3vw,44px)] border-t">
          <li className={step}>
            <div className={copy}>
              <span className={number} aria-hidden="true">
                01
              </span>
              <div>
                <h3 className={title}>Capture once.</h3>
                <p className={description}>
                  Keep experiences, projects, education, and achievements
                  together. Write the details once and reuse them across your
                  resumes.
                </p>
              </div>
            </div>
            <div
              className={`${visual} bg-(--welcome-desk) px-[clamp(9px,3vw,30px)] py-3.5`}
              aria-hidden="true"
            >
              <CareerRecord />
            </div>
          </li>
          <li className={step}>
            <div className={copy}>
              <span className={number} aria-hidden="true">
                02
              </span>
              <div>
                <h3 className={title}>Compose intentionally.</h3>
                <p className={description}>
                  Choose what each resume includes and what comes first. Adjust
                  the wording and layout to fit the role while keeping your
                  shared record intact.
                </p>
              </div>
            </div>
            <div className={`${windowStyle} bg-background`} aria-hidden="true">
              <div className={windowHeader}>
                <span>Design systems</span>
                <span className="font-normal text-muted-foreground">
                  Content selection
                </span>
              </div>
              <ul className="grid gap-1 p-[9px]">
                <li className={`${composeRow} bg-accent`}>
                  <GripVertical className={grip} />
                  <span className={checkbox}>
                    <Check className="size-2.5" />
                  </span>
                  <span>Selected project</span>
                </li>
                <li className={`${composeRow} bg-accent`}>
                  <GripVertical className={grip} />
                  <span className={checkbox}>
                    <Check className="size-2.5" />
                  </span>
                  <span>Experience</span>
                  <span className="text-[0.6875rem] text-primary">
                    Custom wording
                  </span>
                </li>
                <li className={composeRow}>
                  <GripVertical className={grip} />
                  <span className={checkbox} />
                  <span>Education</span>
                </li>
              </ul>
            </div>
          </li>
          <li className={step}>
            <div className={copy}>
              <span className={number} aria-hidden="true">
                03
              </span>
              <div>
                <h3 className={title}>Produce a document.</h3>
                <p className={description}>
                  Save your edits, then refresh the preview when you’re ready.
                  Verso uses LaTeX to build a downloadable PDF from saved
                  content in your browser.
                </p>
              </div>
            </div>
            <div
              className={`${windowStyle} max-h-48 bg-preview-surface`}
              aria-hidden="true"
            >
              <div className={windowHeader}>
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3.5" /> PDF preview
                </span>
                <span className="flex items-center gap-1.5 font-normal text-muted-foreground">
                  <RefreshCw className="size-3.5" /> Refresh
                </span>
              </div>
              <ResumeSheet resume={frontendResume} variant="preview" />
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

function Languages() {
  return (
    <section
      className="scroll-mt-4 border-b bg-(--welcome-desk) py-[clamp(55px,8vw,108px)]"
      id="languages"
      aria-labelledby="languages-title"
    >
      <div className={`${twoColumnSection} items-center`}>
        <div className={sectionIntro}>
          <p className="welcome-kicker text-primary">Content languages</p>
          <h2 className={sectionTitle} id="languages-title">
            Write for the role, in its language.
          </h2>
          <p className={sectionText}>
            PDF output is verified for English and Brazilian Portuguese. Each
            resume uses one language, with wording you write and maintain.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-[clamp(8px,2vw,24px)]">
          {languageExamples.map(({ label, resume }) => (
            <figure
              className="grid min-w-0 grid-rows-[auto_1fr] gap-2"
              key={resume.language}
              lang={resume.language}
            >
              <figcaption className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-input pt-2 text-sm font-[550] welcome-compact:flex-col">
                <span>{label}</span>
                <span className="welcome-kicker text-primary">
                  {resume.language}
                </span>
              </figcaption>
              <ResumeSheet resume={resume} variant="language" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Control() {
  const row =
    "grid grid-cols-[21px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b py-4";
  const icon = "size-[17px] self-center text-primary";
  const title = "text-lg/[1.15] font-medium tracking-[-0.025em]";
  const description =
    "col-start-2 max-w-[56ch] leading-[1.6] text-pretty text-muted-foreground";

  return (
    <section
      className={`${twoColumnSection} items-start py-[clamp(55px,8vw,108px)]`}
      aria-labelledby="control-title"
    >
      <div className={sectionIntro}>
        <p className="welcome-kicker text-primary">Save and storage</p>
        <h2 className={sectionTitle} id="control-title">
          Your work stays in your hands.
        </h2>
      </div>
      <div>
        <dl className="border-t">
          <div className={row}>
            <Check className={icon} aria-hidden="true" />
            <dt className={title}>Save when you’re ready</dt>
            <dd className={description}>
              Save or cancel edits, and undo or redo saved changes. Draft
              recovery keeps unsaved work separate from your saved record and
              PDF.
            </dd>
          </div>
          <div className={row}>
            <Monitor className={icon} aria-hidden="true" />
            <dt className={title}>Work locally as a guest</dt>
            <dd className={description}>
              Your workspace lives in this browser. Download JSON backups so you
              can restore it if browser data is cleared or evicted.
            </dd>
          </div>
          <div className={row}>
            <FileText className={icon} aria-hidden="true" />
            <dt className={title}>Sync and share with an account</dt>
            <dd className={description}>
              Where accounts are enabled, sign in with Google or GitHub to
              access saved work across devices and publish PDFs through links
              you control. Moving guest work into an account requires your
              review.
            </dd>
          </div>
        </dl>
        <p className={note}>
          Verso uses one single-column resume template. PDF/UA, universal ATS
          compatibility, and Safari compatibility remain unverified.
        </p>
      </div>
    </section>
  );
}

/** Product presentation for the public root route. */
export function Welcome() {
  return (
    <div className="bg-(--welcome-editorial) welcome-page">
      <header className="border-b">
        <div className="welcome-frame grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 welcome-compact:min-h-[63px] welcome-compact:gap-0">
          <Link
            href="/"
            aria-label="Verso home"
            className="justify-self-start rounded-md focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            <BrandLockup />
          </Link>
          <WelcomeAppearance />
          <nav
            aria-label="Account"
            className="flex items-center gap-2 justify-self-end welcome-compact:gap-1"
          >
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  className:
                    "min-h-10 motion-reduce:transition-none max-[361px]:text-xs welcome-compact:px-1.5",
                }),
              )}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className:
                    "min-h-10 motion-reduce:transition-none max-[361px]:text-xs welcome-compact:px-1.5",
                }),
              )}
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <section
          className="welcome-frame grid grid-cols-1 items-center gap-[clamp(28px,4vw,56px)] pt-[clamp(42px,6vw,86px)] pb-[clamp(36px,5.3vw,72px)] min-[1120px]:grid-cols-[minmax(0,0.59fr)_minmax(0,1fr)] min-[1120px]:gap-x-[clamp(30px,3.6vw,56px)] min-[1120px]:gap-y-[15px]"
          aria-labelledby="welcome-title"
        >
          <div className="row-start-1">
            <p className="welcome-kicker text-primary">The resume workspace</p>
            <h1
              id="welcome-title"
              className="mt-5 mb-[22px] text-[length:clamp(2.5rem,5.15vw,4.875rem)]/[0.99] font-medium tracking-[-0.071em] min-[1120px]:text-balance welcome-compact:text-[length:clamp(1.96rem,9.5vw,3.6rem)]/[0.99] welcome-compact:tracking-[-0.065em]"
            >
              <span className="block">One career record.</span>{" "}
              <span className="block text-primary">Every tailored resume.</span>
            </h1>
            <p className={`${sectionText} max-[1120px]:max-w-[55ch]`}>
              Keep your career details in one place. Choose what each
              application needs and build a resume around it.
            </p>
            <EntryActions />
            <p className={note}>
              No account needed. Guest work stays in this browser.
            </p>
          </div>
          <TailoringIllustration />
          <a
            className="inline-flex min-h-8 items-center gap-2 justify-self-start text-[0.8125rem] font-medium text-muted-foreground underline decoration-transparent underline-offset-[0.28em] hover:text-primary hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring max-[1120px]:-mt-2.5"
            href="#tailoring"
          >
            <ArrowDown
              className="size-[15px] text-primary"
              aria-hidden="true"
            />
            See how it works
          </a>
        </section>
        <Workflow />
        <Languages />
        <Control />
        <section
          className="welcome-frame pb-[clamp(32px,5vw,64px)]"
          aria-labelledby="closing-title"
        >
          <div className="relative isolate grid min-h-[280px] items-center overflow-clip rounded-[12px] border bg-accent p-[clamp(20px,5vw,68px)]">
            <div className="z-1 w-[min(65%,550px)] [@media(width<=400px)]:w-[88%]">
              <h2 className={sectionTitle} id="closing-title">
                Start with your career record.
              </h2>
              <EntryActions />
            </div>
            <div
              className="pointer-events-none absolute top-[24%] right-[6%] h-full w-[min(34%,340px)] welcome-compact:-right-[2%] [@media(width<=400px)]:top-auto [@media(width<=400px)]:-right-[4%] [@media(width<=400px)]:-bottom-[30%] [@media(width<=400px)]:w-[44%] [@media(width<=400px)]:opacity-55"
              aria-hidden="true"
            >
              <div
                className={`${closingPaper} top-0 left-0 -rotate-10 before:absolute before:inset-x-[13%] before:top-[15%] before:h-[7%] before:border-y before:border-border after:absolute after:inset-x-[13%] after:top-[28%] after:h-[7%] after:border-y after:border-border`}
              />
              <div
                className={`${closingPaper} top-[7%] left-[28%] grid rotate-[9deg] place-items-start justify-items-center pt-[16%] text-primary`}
              >
                <BrandMark className="h-auto w-[34%]" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
