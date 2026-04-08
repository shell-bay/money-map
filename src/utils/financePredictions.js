/**
 * Generates a financial prediction report based on transaction history
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} settings - User settings (must include currency)
 * @returns {string} Formatted prediction report
 */
export function generateFinancialPrediction(transactions, settings) {
  const currencyCode = settings?.currency || 'INR';
  const currencySymbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$'
  };
  const symbol = currencySymbols[currencyCode] || currencyCode;

  const formatCurrency = (amount) => {
    return symbol + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (!transactions || transactions.length < 2) {
    return "Not enough data to generate a reliable prediction.";
  }

  // Group by month
  const monthlyData = new Map();
  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0, categories: {} });
    }
    const month = monthlyData.get(monthKey);
    if (tx.type === 'income') {
      month.income += parseFloat(tx.amount || 0);
    } else {
      month.expenses += parseFloat(tx.amount || 0);
      const cat = tx.category || 'Uncategorized';
      month.categories[cat] = (month.categories[cat] || 0) + parseFloat(tx.amount || 0);
    }
  });

  const sortedMonths = Array.from(monthlyData.keys()).sort();
  if (sortedMonths.length < 2) {
    return "Need at least 2 months of data for prediction.";
  }

  const latestMonth = sortedMonths[sortedMonths.length - 1];
  const latestData = monthlyData.get(latestMonth);
  const prevMonthData = monthlyData.get(sortedMonths[sortedMonths.length - 2]);

  // Averages from last 3 months
  const recentMonths = sortedMonths.slice(-3);
  let avgIncome = 0, avgExpenses = 0;
  recentMonths.forEach(m => {
    const data = monthlyData.get(m);
    avgIncome += data.income;
    avgExpenses += data.expenses;
  });
  avgIncome /= recentMonths.length;
  avgExpenses /= recentMonths.length;

  // Calculate month-over-month change
  const expenseChange = latestData.expenses - prevMonthData.expenses;
  const expenseChangePercent = prevMonthData.expenses > 0 ? (expenseChange / prevMonthData.expenses) * 100 : 0;

  // Project next month (simple trend extrapolation)
  const predictedExpenses = latestData.expenses + expenseChange;
  const predictedSavings = avgIncome - predictedExpenses;

  // Category trends
  const categoryTrends = [];
  Object.entries(latestData.categories).forEach(([cat, amount]) => {
    const prevAmount = prevMonthData.categories[cat] || 0;
    const change = amount - prevAmount;
    const changePercent = prevAmount > 0 ? (change / prevAmount) * 100 : 0;
    categoryTrends.push({ name: cat, change, changePercent, amount });
  });

  const topCategory = Object.entries(latestData.categories)
    .sort((a, b) => b[1] - a[1])[0] || ['None', 0];
  const topCategoryPercent = latestData.expenses > 0 ? (topCategory[1] / latestData.expenses * 100) : 0;

  const fastestGrowing = categoryTrends
    .filter(t => t.change > 0)
    .sort((a, b) => b.changePercent - a.changePercent)[0];

  // Risk detection
  const risks = [];
  if (predictedExpenses > avgIncome * 0.8) {
    risks.push(`Expenses may exceed ${((predictedExpenses/avgIncome)*100).toFixed(0)}% of income`);
  }
  if (predictedSavings < avgIncome * 0.1) {
    risks.push(`Low savings: ${formatCurrency(predictedSavings)} (${((predictedSavings/avgIncome)*100).toFixed(0)}% of income)`);
  }
  if (topCategoryPercent > 35) {
    risks.push(`${topCategory[0]} is ${topCategoryPercent.toFixed(0)}% of expenses - diversify spending`);
  }

  // Current month comparison
  const currentSavings = avgIncome - latestData.expenses;
  const savingsDrop = currentSavings > 0 ? ((currentSavings - predictedSavings) / currentSavings * 100).toFixed(0) : 0;

  // Action plan
  const actions = [];
  if (topCategory[0] !== 'None' && topCategoryPercent > 25) {
    actions.push(`Reduce ${topCategory[0]} by 10% (save ${formatCurrency(topCategory[1] * 0.1)})`);
  }
  if (expenseChangePercent > 10) {
    actions.push(`Spending grew ${expenseChangePercent.toFixed(0)}% MoM - set budget cap at ${formatCurrency(avgExpenses * 0.9)}`);
  }
  if (predictedSavings < avgIncome * 0.2) {
    actions.push(`Automate ${formatCurrency(avgIncome * 0.2)} savings before spending`);
  }
  if (actions.length === 0) {
    actions.push('Maintain current spending patterns - projections look healthy');
    actions.push('Consider increasing investments by 5%');
    actions.push('Review subscriptions weekly to catch creep');
  }

  return `🔮 PREDICTION REPORT

📊 NEXT MONTH FORECAST
Expected Expenses: ${formatCurrency(predictedExpenses)}
Expected Savings: ${formatCurrency(predictedSavings)}
Top Category: ${topCategory[0]} (${topCategoryPercent.toFixed(1)}% of spend)

📈 TREND ANALYSIS
• Spending Trend: ${expenseChange > 0 ? '📈 Increasing' : expenseChange < 0 ? '📉 Decreasing' : '➡️ Stable'} (${Math.abs(expenseChangePercent).toFixed(1)}% vs last month)
• Fastest Growing: ${fastestGrowing ? `${fastestGrowing.name} (+${fastestGrowing.changePercent.toFixed(1)}%)` : 'None'}
• Income Stability: ${(avgIncome / latestData.income).toFixed(2)}x vs current

⚠️ RISK ALERTS
${risks.length > 0 ? risks.map(r => `• ${r}`).join('\n') : '• No significant risks detected'}

💡 SMART FORECAST
• If trends continue, savings ${savingsDrop > 0 ? `may drop by ${Math.abs(savingsDrop)}%` : 'will improve'} next month
• ${fastestGrowing ? `${fastestGrowing.name} needs attention - growing ${fastestGrowing.changePercent > 0 ? '+' : ''}${fastestGrowing.changePercent.toFixed(1)}%` : 'Spending patterns are stable'}

🎯 ACTION PLAN
${actions.map(a => `✓ ${a}`).join('\n')}`;
}
