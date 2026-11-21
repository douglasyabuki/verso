import type { Metadata } from "next";

import { AuthScreen } from "@/components/account/auth-screen";

export const metadata: Metadata = { title: "Create an account · Verso" };

export default function SignUpPage() {
  return <AuthScreen mode="sign-up" />;
}
