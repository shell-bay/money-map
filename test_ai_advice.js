/**
 * Test script: Send sample financial data to backend AI advisor
 * Run: node test_ai_advice.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAI() {
  // Sample transactions
  const transactions = [
    { type: 'income', amount: 50000, category: 'Salary', date: '2025-03-01' },
    { type: 'expense', amount: 15000, category: 'Rent', date: '2025-03-02' },
    { type: 'expense', amount: 5000, category: 'Groceries', date: '2025-03-03' },
    { type: 'expense', amount: 2000, category: 'Entertainment', date: '2025-03-04' },
    { type: 'expense', amount: 3000, category: 'Transport', date: '2025-03-05' }
  ];

  // Prepare financial data (mimic frontend's prepareFinancialData)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0;

  // Category breakdown
  const categoryMap = new Map();
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Uncategorized';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.amount);
  });
  const categoryBreakdown = Array.from(categoryMap, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const financialDataSummary = `
Financial Data Summary:
- Total Income: ₹${totalIncome.toLocaleString('en-IN')}
- Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
- Balance: ₹${balance.toLocaleString('en-IN')}
- Savings Rate: ${savingsRate}%
- Transaction Count: ${transactions.length}

Spending by Category:
${categoryBreakdown.map(cat => `  • ${cat.name}: ₹${cat.value.toLocaleString('en-IN')} (${((cat.value/totalExpenses)*100).toFixed(1)}%)`).join('\n')}

Recent Transactions:
${transactions.slice(0, 10).map(t => `  • ${t.type === 'income' ? '+' : '-'} ₹${t.amount.toLocaleString('en-IN')} - ${t.category} (${t.date})`).join('\n')}
`.trim();

  console.log('📊 Financial Data Summary:');
  console.log(financialDataSummary);
  console.log('\n🤖 Requesting AI advice...\n');

  // Call backend proxy with conversation history (single user message)
  try {
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are a professional financial advisor AI integrated into the Money Map app.

CRITICAL RULES:
1. ONLY answer questions related to personal finance, budgeting, expenses, savings, and money management
2. If asked about non-finance topics, politely decline and redirect to finance
3. Use the provided financial data as context for your advice
4. Keep responses concise (max 200 words), structured, and actionable
5. Be non-judgmental, supportive, and practical
6. Always base advice on numbers and percentages from the data

RESPONSE FORMAT:
### 1. Key Insights
- [Bullet points about spending patterns, unusual activity, income vs expense ratio]

### 2. Smart Suggestions
- [Specific, actionable ways to reduce expenses or improve budgeting]

### 3. Warnings (if applicable)
- [Alerts about overspending, low balance, high category concentrations]

### 4. Positive Feedback (if applicable)
- [Acknowledge good financial habits]

User Financial Data:
${financialDataSummary}`
          },
          {
            role: 'user',
            content: 'Please analyze my financial data and provide comprehensive advice.'
          }
        ],
        config: {
          MODEL: 'meta/llama-3.3-70b-instruct',
          TEMPERATURE: 0.2,
          TOP_P: 0.7,
          MAX_TOKENS: 1024
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Backend error ${response.status}: ${err.error || err.message || 'Unknown'}`);
    }

    // Stream the response (using async iteration for Node.js streams)
    const decoder = new TextDecoder();
    let fullText = '';

    console.log('--- AI RESPONSE (streaming) ---\n');

    // Read stream as async iterable (works for Node.js readable streams)
    for await (const chunk of response.body) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            const json = JSON.parse(jsonStr);
            const content = json.content;
            if (content) {
              process.stdout.write(content);
              fullText += content;
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    }

    console.log('\n\n--- END OF RESPONSE ---');
    console.log(`\n✅ Test complete! Total characters: ${fullText.length}`);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

testAI();
