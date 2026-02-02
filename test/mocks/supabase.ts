import { vi } from "vitest";

/**
 * Chainable mock builder that mimics the Supabase query builder API.
 * Each call to .from() returns a fresh chain. Configure the terminal
 * result via `mockResult` before the chain is consumed.
 */

export interface MockResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

export function createMockSupabaseClient() {
  let terminalResult: MockResult = { data: null, error: null };

  function buildChain(): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: Record<string, any> = {};

    const methods = [
      "select",
      "insert",
      "update",
      "delete",
      "upsert",
      "eq",
      "neq",
      "in",
      "is",
      "gt",
      "gte",
      "lt",
      "lte",
      "like",
      "ilike",
      "or",
      "order",
      "limit",
      "range",
      "match",
      "filter",
    ];

    for (const method of methods) {
      chain[method] = vi.fn(() => chain);
    }

    // Terminal methods that resolve the chain
    chain.single = vi.fn(() => Promise.resolve(terminalResult));
    chain.maybeSingle = vi.fn(() => Promise.resolve(terminalResult));
    chain.then = vi.fn((resolve: (value: MockResult) => void) => {
      resolve(terminalResult);
      return Promise.resolve(terminalResult);
    });

    // Make chain thenable so `await supabase.from(...).select(...)` works
    Object.defineProperty(chain, "then", {
      value: (
        resolve?: (value: MockResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => {
        return Promise.resolve(terminalResult).then(resolve, reject);
      },
      writable: true,
      configurable: true,
    });

    return chain as Record<string, unknown>;
  }

  const client = {
    from: vi.fn(() => buildChain()),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      ),
      signUp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ data: {}, error: null })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    },
    /**
     * Set what the next chain resolution will return.
     * Call this before invoking the server action.
     */
    mockResult(result: MockResult) {
      terminalResult = result;
      return client;
    },
    /**
     * Set up per-table results. Returns a configurator object.
     */
    mockChain() {
      return {
        /**
         * Override `from()` to return custom chain results per call index.
         * Pass an array of results; each successive `.from()` call consumes the next.
         */
        sequence(results: MockResult[]) {
          let callIndex = 0;
          client.from.mockImplementation(() => {
            const result = results[callIndex] ?? { data: null, error: null };
            callIndex++;

            // Build a chain that resolves to this specific result
            const chain: Record<string, unknown> = {};
            const methods = [
              "select",
              "insert",
              "update",
              "delete",
              "upsert",
              "eq",
              "neq",
              "in",
              "is",
              "gt",
              "gte",
              "lt",
              "lte",
              "like",
              "ilike",
              "or",
              "order",
              "limit",
              "range",
              "match",
              "filter",
            ];

            for (const method of methods) {
              (chain as Record<string, ReturnType<typeof vi.fn>>)[method] = vi.fn(() => chain);
            }

            chain.single = vi.fn(() => Promise.resolve(result));
            chain.maybeSingle = vi.fn(() => Promise.resolve(result));

            Object.defineProperty(chain, "then", {
              value: (
                resolve?: (value: MockResult) => unknown,
                reject?: (reason: unknown) => unknown
              ) => {
                return Promise.resolve(result).then(resolve, reject);
              },
              writable: true,
              configurable: true,
            });

            return chain;
          });
          return client;
        },
      };
    },
  };

  return client;
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>;
