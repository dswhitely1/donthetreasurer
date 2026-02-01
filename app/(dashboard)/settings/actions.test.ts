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
import { updateProfile, changePassword, deleteAccount } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";

describe("settings actions", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId, email: "test@test.com" } },
      error: null,
    } as never);
  });

  function makeFormData(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, val] of Object.entries(data)) {
      fd.set(key, val);
    }
    return fd;
  }

  describe("updateProfile", () => {
    it("returns error for empty name", async () => {
      const fd = makeFormData({ name: "" });
      const result = await updateProfile(null, fd);
      expect(result).toEqual({ error: "Name is required." });
    });

    it("returns error for name over 100 characters", async () => {
      const fd = makeFormData({ name: "A".repeat(101) });
      const result = await updateProfile(null, fd);
      expect(result?.error).toContain("100 characters");
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ name: "Test" });
      const result = await updateProfile(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("returns success on successful update", async () => {
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({ name: "Updated Name" });
      const result = await updateProfile(null, fd);
      expect(result).toEqual({ success: true });
    });

    it("returns error on database failure", async () => {
      mockSupabase.mockResult({ data: null, error: { message: "db error" } });

      const fd = makeFormData({ name: "Test" });
      const result = await updateProfile(null, fd);
      expect(result?.error).toContain("Failed to update profile");
    });

    it("trims whitespace from name", async () => {
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({ name: "  John  " });
      const result = await updateProfile(null, fd);
      expect(result).toEqual({ success: true });
    });
  });

  describe("changePassword", () => {
    it("returns error for missing fields", async () => {
      const fd = makeFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      const result = await changePassword(null, fd);
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("returns error for short new password", async () => {
      const fd = makeFormData({
        currentPassword: "current123",
        newPassword: "short",
        confirmPassword: "short",
      });
      const result = await changePassword(null, fd);
      expect(result?.error).toContain("at least 8 characters");
    });

    it("returns error for mismatched passwords", async () => {
      const fd = makeFormData({
        currentPassword: "current123",
        newPassword: "password123",
        confirmPassword: "different123",
      });
      const result = await changePassword(null, fd);
      expect(result?.error).toContain("do not match");
    });

    it("re-authenticates with current password", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid credentials" },
      } as never);

      const fd = makeFormData({
        currentPassword: "wrong",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      });
      const result = await changePassword(null, fd);
      expect(result?.error).toBe("Current password is incorrect.");
    });

    it("returns success on successful change", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: null,
      } as never);
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: {},
        error: null,
      } as never);

      const fd = makeFormData({
        currentPassword: "current123",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      });
      const result = await changePassword(null, fd);
      expect(result).toEqual({ success: true });
    });

    it("returns error when updateUser fails", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: null,
      } as never);
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: {},
        error: { message: "update failed" },
      } as never);

      const fd = makeFormData({
        currentPassword: "current123",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      });
      const result = await changePassword(null, fd);
      expect(result?.error).toContain("Failed to update password");
    });
  });

  describe("deleteAccount", () => {
    it("requires DELETE confirmation", async () => {
      const fd = makeFormData({ confirmation: "delete" });
      const result = await deleteAccount(null, fd);
      expect(result?.error).toContain('type "DELETE"');
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ confirmation: "DELETE" });
      const result = await deleteAccount(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("deletes treasurer and redirects to login", async () => {
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({ confirmation: "DELETE" });

      try {
        await deleteAccount(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe("/login");
      }

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it("returns error on deletion failure", async () => {
      mockSupabase.mockResult({ data: null, error: { message: "delete failed" } });

      const fd = makeFormData({ confirmation: "DELETE" });
      const result = await deleteAccount(null, fd);
      expect(result?.error).toContain("Failed to delete account");
    });
  });
});
