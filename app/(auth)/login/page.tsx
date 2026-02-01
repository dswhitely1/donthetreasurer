import type { Metadata } from "next";

import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to Treasurer to manage your nonprofit organization finances.",
};

export default function LoginPage() {
  return <LoginForm />;
}
