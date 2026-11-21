import type { Metadata } from "next";

import { AccountRoot } from "@/components/account/account-root";

export const metadata: Metadata = { title: "Verso" };

/** Workspace for guests and account owners. The client reads the destination from the
 * URL, so this page never reads `params` and stays a static shell for every path. */
export default function WorkspacePage() {
  return <AccountRoot />;
}
