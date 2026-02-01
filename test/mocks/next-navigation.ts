import { vi } from "vitest";

/**
 * Mocks for next/navigation and next/cache used in server actions.
 *
 * `redirect` throws a special error so tests can assert the redirect target.
 * Catch it with: `expect(result).rejects.toThrow("NEXT_REDIRECT")` or
 * by wrapping in try/catch.
 */

export class RedirectError extends Error {
  public readonly url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.name = "RedirectError";
    this.url = url;
  }
}

export const mockRedirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});

export const mockRevalidatePath = vi.fn();
export const mockRevalidateTag = vi.fn();

export const mockUseRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

export const mockUseParams = vi.fn(() => ({}));
export const mockUsePathname = vi.fn(() => "/");
export const mockUseSearchParams = vi.fn(() => new URLSearchParams());

/**
 * Helper to extract redirect URL from a server action call.
 * Calls the action and returns the redirect URL if one was thrown.
 */
export async function captureRedirect(
  fn: () => Promise<unknown>
): Promise<string> {
  try {
    await fn();
    throw new Error("Expected redirect but none occurred");
  } catch (err) {
    if (err instanceof RedirectError) {
      return err.url;
    }
    throw err;
  }
}
