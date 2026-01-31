"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signIn } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <>
      <h2 className="mb-6 text-lg font-semibold text-zinc-900">Sign in</h2>

      <form action={formAction} className="flex flex-col gap-4">
        {state?.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-zinc-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {pending ? "Signing in\u2026" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-zinc-900 hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
