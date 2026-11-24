import type { Metadata } from "next";

import { NotFoundScreen } from "@/components/brand/not-found-screen";

export const metadata: Metadata = { title: "Page not found · Verso" };

export default function NotFound() {
  return <NotFoundScreen />;
}
