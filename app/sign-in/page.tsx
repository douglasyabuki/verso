import type { Metadata } from "next";

import { AuthScreen } from "@/components/account/auth-screen";

export const metadata: Metadata = { title: "Sign in · Verso" };

export default function SignInPage() {
  return <AuthScreen mode="sign-in" />;
}
