"use client";

import { House, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ACCOUNT_ROUTES } from "@/types-and-constants/account";

/** Link to the workspace, and to the home page only for visitors without a
 * session: for signed-in users `/` redirects to `/app`, so both would lead to the
 * same view. The session is checked here, after the 404 renders, so the root
 * not-found boundary reads no request data and every other route stays static.
 * Home stays hidden until the check confirms a guest (or accounts are off).
 */
export function NotFoundActions() {
  const [showHome, setShowHome] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(ACCOUNT_ROUTES.session, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        // 503 means accounts are not enabled: every visitor is a guest.
        if (response.status === 503) return null;
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as unknown;
      })
      .then((session) => setShowHome(session === null))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Link href="/app" className={buttonVariants({ size: "lg" })}>
        <LayoutDashboard data-icon="inline-start" aria-hidden="true" />
        Open workspace
      </Link>
      {showHome && (
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <House data-icon="inline-start" aria-hidden="true" />
          Home
        </Link>
      )}
    </div>
  );
}
