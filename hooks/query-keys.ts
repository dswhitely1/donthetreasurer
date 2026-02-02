export const organizationKeys = {
  all: ["organizations"] as const,
  list: () => [...organizationKeys.all, "list"] as const,
  detail: (orgId: string) => [...organizationKeys.all, "detail", orgId] as const,
};

export const accountKeys = {
  all: ["accounts"] as const,
  list: (orgId: string) => [...accountKeys.all, "list", orgId] as const,
  balances: (orgId: string) => [...accountKeys.all, "balances", orgId] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  list: (orgId: string) => [...categoryKeys.all, "list", orgId] as const,
};

export interface TransactionFilters {
  accountId?: string;
  status?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (orgId: string, filters?: TransactionFilters) =>
    [...transactionKeys.all, "list", orgId, filters ?? {}] as const,
  detail: (orgId: string, txnId: string) =>
    [...transactionKeys.all, "detail", orgId, txnId] as const,
};

export interface ReportParams {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  categoryId?: string;
  status?: string;
}

export const reconciliationKeys = {
  all: ["reconciliation"] as const,
  list: (accountId: string) =>
    [...reconciliationKeys.all, "list", accountId] as const,
  detail: (sessionId: string) =>
    [...reconciliationKeys.all, "detail", sessionId] as const,
};

export const reportKeys = {
  all: ["reports"] as const,
  data: (orgId: string, params?: ReportParams) =>
    [...reportKeys.all, "data", orgId, params ?? {}] as const,
};

export const templateKeys = {
  all: ["templates"] as const,
  list: (orgId: string) => [...templateKeys.all, "list", orgId] as const,
  detail: (orgId: string, templateId: string) =>
    [...templateKeys.all, "detail", orgId, templateId] as const,
};

export const receiptKeys = {
  all: ["receipts"] as const,
  list: (transactionId: string) =>
    [...receiptKeys.all, "list", transactionId] as const,
  signedUrl: (orgId: string, receiptId: string) =>
    [...receiptKeys.all, "signedUrl", orgId, receiptId] as const,
};
