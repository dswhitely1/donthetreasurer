interface AccountInfo {
  id: string;
  opening_balance: number | null;
}

interface TransactionInfo {
  account_id: string;
  amount: number;
  transaction_type: string;
}

export interface AccountBalance {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
}

/**
 * Compute balances for a set of accounts given their transactions.
 * Returns a Map keyed by account ID.
 */
export function getAccountBalances(
  accounts: AccountInfo[],
  transactions: TransactionInfo[]
): Map<string, AccountBalance> {
  const result = new Map<string, AccountBalance>();

  for (const account of accounts) {
    result.set(account.id, {
      currentBalance: account.opening_balance ?? 0,
      totalIncome: 0,
      totalExpense: 0,
    });
  }

  for (const txn of transactions) {
    const entry = result.get(txn.account_id);
    if (!entry) continue;

    if (txn.transaction_type === "income") {
      entry.totalIncome += txn.amount;
      entry.currentBalance += txn.amount;
    } else {
      entry.totalExpense += txn.amount;
      entry.currentBalance -= txn.amount;
    }
  }

  return result;
}

interface RunningBalanceTransaction {
  id: string;
  amount: number;
  transaction_type: string;
}

/**
 * Compute running balance for a list of transactions sorted in chronological order.
 * Returns a Map from transaction ID to the balance after that transaction.
 */
export function computeRunningBalances(
  openingBalance: number,
  transactions: RunningBalanceTransaction[]
): Map<string, number> {
  const result = new Map<string, number>();
  let balance = openingBalance;

  for (const txn of transactions) {
    if (txn.transaction_type === "income") {
      balance += txn.amount;
    } else {
      balance -= txn.amount;
    }
    result.set(txn.id, balance);
  }

  return result;
}
