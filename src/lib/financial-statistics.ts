export function includedTransactions<T extends { id: string }>(rows: T[], excludedIds: ReadonlySet<string>): T[] {
  return rows.filter((row) => !excludedIds.has(row.id));
}

export function transactionTotals(rows: { amount: number }[]) {
  return rows.reduce((total, row) => ({
    income: total.income + Math.max(0, Number(row.amount)),
    spending: total.spending + Math.max(0, -Number(row.amount)),
  }), { income: 0, spending: 0 });
}