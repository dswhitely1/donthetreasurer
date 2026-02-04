import { describe, expect, it } from "vitest";

import { computePaymentStatus } from "./payment-status";

describe("computePaymentStatus", () => {
  it('returns "unpaid" when no payments made', () => {
    expect(computePaymentStatus(100, 0)).toBe("unpaid");
  });

  it('returns "partial" when some payment made', () => {
    expect(computePaymentStatus(100, 50)).toBe("partial");
    expect(computePaymentStatus(100, 99.99)).toBe("partial");
    expect(computePaymentStatus(100, 0.01)).toBe("partial");
  });

  it('returns "paid" when full payment made', () => {
    expect(computePaymentStatus(100, 100)).toBe("paid");
    expect(computePaymentStatus(50.5, 50.5)).toBe("paid");
  });

  it('returns "overpaid" when payment exceeds fee', () => {
    expect(computePaymentStatus(100, 100.01)).toBe("overpaid");
    expect(computePaymentStatus(100, 200)).toBe("overpaid");
  });

  it('returns "paid" when fee is zero', () => {
    expect(computePaymentStatus(0, 0)).toBe("paid");
  });

  it('returns "paid" when fee is zero even with payments', () => {
    // Edge case: free enrollment with payments shouldn't happen,
    // but if it does, treat as paid
    expect(computePaymentStatus(0, 10)).toBe("paid");
  });

  it("handles floating-point precision in multi-payment sums", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(computePaymentStatus(0.3, 0.1 + 0.2)).toBe("paid");
    // Three payments of $33.33 against $99.99 fee
    expect(computePaymentStatus(99.99, 33.33 + 33.33 + 33.33)).toBe("paid");
  });
});
