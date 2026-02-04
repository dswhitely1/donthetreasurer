import type { PaymentStatus } from "@/lib/validations/season";

export function computePaymentStatus(
  feeAmount: number,
  totalPaid: number
): PaymentStatus {
  if (feeAmount === 0) return "paid";
  if (totalPaid === 0) return "unpaid";
  if (totalPaid < feeAmount) return "partial";
  if (totalPaid === feeAmount) return "paid";
  return "overpaid";
}
