import type { PaymentStatus } from "@/lib/validations/season";

export interface SeasonReportPayment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
}

export interface SeasonReportEnrollment {
  id: string;
  studentName: string;
  guardianName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  feeAmount: number;
  totalPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  enrollmentStatus: string;
  payments: SeasonReportPayment[];
}

export interface SeasonReportData {
  organizationName: string;
  seasonName: string;
  seasonDescription: string | null;
  startDate: string;
  endDate: string;
  feeAmount: number;
  status: string;
  generatedAt: string;
  summary: {
    totalEnrolled: number;
    totalFeesExpected: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  enrollments: SeasonReportEnrollment[];
}
