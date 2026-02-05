export interface ReportLineItem {
  categoryLabel: string;
  amount: number;
  memo: string | null;
}

export interface ReportTransaction {
  id: string;
  transactionDate: string;
  createdAt: string | null;
  accountName: string;
  checkNumber: string | null;
  vendor: string | null;
  description: string;
  transactionType: "income" | "expense";
  amount: number;
  status: "uncleared" | "cleared" | "reconciled";
  clearedAt: string | null;
  lineItems: ReportLineItem[];
  runningBalance: number | null;
}

export interface AccountBalanceSummary {
  accountName: string;
  startingBalance: number;
  endingBalance: number;
}

export interface ReportCategorySummary {
  parentName: string;
  children: { name: string; total: number }[];
  subtotal: number;
}

export interface ReportSummary {
  totalIncome: number;
  totalExpenses: number;
  netChange: number;
  balanceByStatus: {
    uncleared: number;
    cleared: number;
    reconciled: number;
  };
  incomeByCategory: ReportCategorySummary[];
  expensesByCategory: ReportCategorySummary[];
}

export interface ReportData {
  organizationName: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  fiscalYearLabel?: string;
  transactions: ReportTransaction[];
  summary: ReportSummary;
  accountBalances: AccountBalanceSummary[] | null;
}

export interface SeasonTotals {
  enrolledCount: number;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  /** Collection rate as a percentage (0-100), not a ratio (0-1). */
  collectionRate: number;
}

export interface SeasonSummaryLine extends SeasonTotals {
  seasonId: string;
  seasonName: string;
  startDate: string;
  endDate: string;
  baseFee: number;
}

export interface SeasonsReportData {
  seasons: SeasonSummaryLine[];
  grandTotals: SeasonTotals;
}
