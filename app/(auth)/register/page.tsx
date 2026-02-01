import type { Metadata } from "next";

import RegisterForm from "./register-form";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create a Treasurer account to start managing your nonprofit organization finances.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
