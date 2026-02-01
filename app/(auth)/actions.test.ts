import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import {
  mockRedirect,
  mockRevalidatePath,
  RedirectError,
} from "@/test/mocks/next-navigation";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

import { createClient } from "@/lib/supabase/server";
import { signUp, signIn, signOut } from "./actions";

const mockedCreateClient = vi.mocked(createClient);

describe("auth actions", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
  });

  function makeFormData(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, val] of Object.entries(data)) {
      fd.set(key, val);
    }
    return fd;
  }

  describe("signUp", () => {
    it("returns error when fields are missing", async () => {
      const fd = makeFormData({ name: "", email: "", password: "", confirmPassword: "" });
      const result = await signUp(null, fd);
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("returns error when password is too short", async () => {
      const fd = makeFormData({
        name: "Test",
        email: "test@test.com",
        password: "short",
        confirmPassword: "short",
      });
      const result = await signUp(null, fd);
      expect(result).toEqual({ error: "Password must be at least 8 characters." });
    });

    it("returns error when passwords don't match", async () => {
      const fd = makeFormData({
        name: "Test",
        email: "test@test.com",
        password: "password123",
        confirmPassword: "different123",
      });
      const result = await signUp(null, fd);
      expect(result).toEqual({ error: "Passwords do not match." });
    });

    it("returns error from supabase auth", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: "Email already exists" },
      } as never);

      const fd = makeFormData({
        name: "Test",
        email: "test@test.com",
        password: "password123",
        confirmPassword: "password123",
      });
      const result = await signUp(null, fd);
      expect(result).toEqual({ error: "Email already exists" });
    });

    it("returns error when user is null after signup", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({
        name: "Test",
        email: "test@test.com",
        password: "password123",
        confirmPassword: "password123",
      });
      const result = await signUp(null, fd);
      expect(result).toEqual({ error: "Sign up failed. Please try again." });
    });

    it("creates treasurer profile and redirects on success", async () => {
      const userId = "user-123";
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      } as never);
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({
        name: "John Treasurer",
        email: "john@test.com",
        password: "password123",
        confirmPassword: "password123",
      });

      try {
        await signUp(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe("/dashboard");
      }
    });

    it("returns error when profile creation fails", async () => {
      const userId = "user-123";
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      } as never);
      mockSupabase.mockResult({ data: null, error: { message: "insert error" } });

      const fd = makeFormData({
        name: "John",
        email: "john@test.com",
        password: "password123",
        confirmPassword: "password123",
      });
      const result = await signUp(null, fd);
      expect(result?.error).toContain("profile setup failed");
    });
  });

  describe("signIn", () => {
    it("returns error when fields are missing", async () => {
      const fd = makeFormData({ email: "", password: "" });
      const result = await signIn(null, fd);
      expect(result).toEqual({ error: "Email and password are required." });
    });

    it("returns error from supabase auth", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid credentials" },
      } as never);

      const fd = makeFormData({ email: "test@test.com", password: "wrong" });
      const result = await signIn(null, fd);
      expect(result).toEqual({ error: "Invalid credentials" });
    });

    it("redirects to dashboard on success", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: null,
      } as never);

      const fd = makeFormData({ email: "test@test.com", password: "password123" });

      try {
        await signIn(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe("/dashboard");
      }
    });
  });

  describe("signOut", () => {
    it("signs out and redirects to login", async () => {
      try {
        await signOut();
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe("/login");
      }
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });
});
