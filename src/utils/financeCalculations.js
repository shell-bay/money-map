/**
 * Centralized financial calculations for consistent data across the app
 */

/**
 * Filter transactions by date range
 * @param {Array} transactions - Array of transaction objects with date field (ISO string)
 * @param {number} days - Number of days to look back (e.g., 30 for last 30 days)
 * @returns {Array} Filtered transactions
 */
export function filterTransactionsByDateRange(transactions, days) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDateStr = cutoff.toISOString().split('T')[0];

  return transactions.filter(tx => {
    const txDate = typeof tx.date === 'string' ? tx.date.split('T')[0] : tx.date;
    return txDate >= cutoffDateStr;
  });
}

/**
 * Calculate total income from transactions
 * @param {Array} transactions
 * @returns {number}
 */
export function calculateTotalIncome(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  return transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Calculate total expenses from transactions
 * @param {Array} transactions
 * @returns {number}
 */
export function calculateTotalExpenses(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Calculate balance (income - expenses)
 * @param {Array} transactions
 * @returns {number}
 */
export function calculateBalance(transactions) {
  const income = calculateTotalIncome(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return income - expenses;
}

/**
 * Calculate transaction count
 * @param {Array} transactions
 * @returns {number}
 */
export function calculateTransactionCount(transactions) {
  return transactions ? transactions.length : 0;
}

/**
 * Calculate average transaction amount (based on expenses)
 * @param {Array} transactions
 * @returns {number}
 */
export function calculateAverageTransaction(transactions) {
  const count = calculateTransactionCount(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return count > 0 ? Number((expenses / count).toFixed(2)) : 0;
}
