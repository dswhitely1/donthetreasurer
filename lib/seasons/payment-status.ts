import type { PaymentStatus } from "@/lib/validations/season";

export function computePaymentStatus(
  feeAmount: number,
  totalPaid: number
): PaymentStatus {
  // Compare in integer cents to avoid floating-point precision issues
  const fee = Math.round(feeAmount * 100);
  const paid = Math.round(totalPaid * 100);
  if (fee === 0) return "paid";
  if (paid === 0) return "unpaid";
  if (paid < fee) return "partial";
  if (paid === fee) return "paid";
  return "overpaid";
}
