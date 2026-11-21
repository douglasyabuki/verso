import { ArrowRight, Cloud, HardDrive } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand";
import { LanguageFlag } from "@/components/shared/language-flag";
import { ThemeSelector } from "@/components/theme-selector";
import { buttonVariants } from "@/components/ui/button";
import { welcomeFeatures } from "@/components/welcome/features";
import { workspaceBasePath } from "@/lib/career/navigation";

/** Static illustration of one career record feeding two tailored resumes. */
function ProductSketch() {
  const resumes = [
    {
      locale: "en-US" as const,
      title: "Product designer",
      lines: ["w-11/12", "w-9/12", "w-10/12"],
    },
    {
      locale: "pt-BR" as const,
      title: "Designer de produto",
      lines: ["w-10/12", "w-11/12", "w-8/12"],
    },
  ];
  return (
    <div
      aria-hidden="true"
      className="grid gap-4 rounded-xl border bg-preview-surface p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:p-6"
    >
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Career record
        </p>
        {["Experience", "Education", "Projects"].map((section, index) => (
          <div key={section} className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{section}</p>
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <div
              className={`h-1.5 rounded-full bg-muted ${index === 1 ? "w-7/12" : "w-9/12"}`}
            />
          </div>
        ))}
      </div>
      <ArrowRight className="mx-auto size-5 rotate-90 text-primary sm:rotate-0" />
      <div className="flex flex-col gap-3">
        {resumes.map((resume) => (
          <div
            key={resume.locale}
            className="flex flex-col gap-2 rounded-xl border bg-white p-4 text-[#202827] shadow-[0_8px_28px_rgb(0_0_0/12%)]"
          >
            <div className="flex items-center gap-2">
              <LanguageFlag locale={resume.locale} />
              <p className="text-sm font-medium">{resume.title}</p>
            </div>
            {resume.lines.map((width, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full bg-[#E9EFEC] ${width}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Product presentation page with Sign in, Sign up, and guest entry points.
 * Static: authenticated visitors are redirected to the workspace before rendering.
 * @returns The welcome page.
 * @example <Welcome />
 */
export function Welcome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-10">
        <Link href="/" aria-label="Verso home" className="rounded-md">
          <BrandLockup />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "ghost" })}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "outline" })}
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-10 pb-16 sm:px-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="flex flex-col gap-6">
            <h1 className="text-[28px] leading-tight font-medium tracking-[-0.035em] text-balance md:text-[40px]">
              One career record. Every tailored resume.
            </h1>
            <p className="max-w-xl text-base text-pretty text-muted-foreground">
              Verso keeps your experience and wording in one place, so each
              resume you send is a deliberate selection, in English or Brazilian
              Portuguese, with LaTeX PDFs generated in your browser.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={workspaceBasePath}
                className={buttonVariants({ size: "lg", className: "px-4" })}
              >
                Continue as guest
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className: "px-4",
                })}
              >
                Create an account
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              No account needed. As a guest, your work is saved in this browser.
            </p>
          </div>
          <ProductSketch />
        </section>

        <section aria-labelledby="features-title" className="border-y bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-10">
            <h2 id="features-title" className="text-xl font-medium">
              Built for people who tailor every application
            </h2>
            <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {welcomeFeatures.map((feature) => (
                <li key={feature.title} className="flex flex-col gap-2">
                  <feature.icon
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="storage-title"
          className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-10"
        >
          <h2 id="storage-title" className="text-xl font-medium">
            Choose where your work lives
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <HardDrive className="size-5 text-primary" aria-hidden="true" />
                <h3 className="font-medium">Guest</h3>
              </div>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
                <li>Start immediately, with no sign-in.</li>
                <li>Your workspace is stored in this browser only.</li>
                <li>
                  Clearing browser data can remove it, so download JSON backups.
                </li>
              </ul>
              <Link
                href={workspaceBasePath}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-auto self-start",
                })}
              >
                Continue as guest
              </Link>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <Cloud className="size-5 text-primary" aria-hidden="true" />
                <h3 className="font-medium">Account</h3>
              </div>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
                <li>
                  Sign in with Google or GitHub, and connect both if you like.
                </li>
                <li>
                  Saves are confirmed by the server and open on your other
                  devices.
                </li>
                <li>Publish resume PDFs through public links you control.</li>
                <li>
                  Your guest workspace is never merged automatically; you review
                  any import first. You can delete your account at any time.
                </li>
              </ul>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href="/sign-up" className={buttonVariants()}>
                  Create an account
                </Link>
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Verso uses one single-column resume template. It does not claim
            PDF/UA, universal ATS, or Safari compatibility.
          </p>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-10">
          <p className="text-sm text-muted-foreground">
            Verso · Bilingual resume workspace
          </p>
          <ThemeSelector />
        </div>
      </footer>
    </div>
  );
}
