import type { Metadata } from "next";

import { Welcome } from "@/components/welcome/welcome";

export const metadata: Metadata = {
  title: "Verso · Bilingual resume workspace",
  description:
    "Keep one career record and tailor every resume from it, in English or Brazilian Portuguese, with LaTeX PDFs generated in your browser.",
};

/** Product presentation page. Visitors with a session cookie are redirected to `/app` by `proxy.ts`. */
export default function Home() {
  return <Welcome />;
}
