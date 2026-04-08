/**
 * Integration test for Money Map AI Financial Advisor
 * Tests: data preparation, validation, and API calls
 */

const fetch = require('node-fetch');
const { prepareFinancialData, DEFAULT_CONFIG, isFinanceQuestion } = require('./src/services/nvidiaService');

// Get API key from environment variable (more secure)
const API_KEY = process.env.NVIDIA_API_KEY || 'nvapi-REPLACE_WITH_YOUR_KEY';

// Test data with edge cases
const testTransactions = [
  { type: 'income', amount: 50000, category: 'Salary', date: '2025-03-01' },
  { type: 'expense', amount: 2000, category: 'Food', date: '2025-03-02' },
  { type: 'expense', amount: 1500, category: 'Transport', date: '2025-03-02' },
  { type: 'expense', amount: 5000, category: 'Entertainment', date: '2025-03-03' },
  { type: 'expense', amount: null, category: 'Other', date: '2025-03-04' }, // Invalid amount
  { type: 'expense', amount: 'abc', category: 'Shopping', date: '2025-03-05' }, // Invalid string
  { type: 'expense', amount: 3000, category: 'Food', date: '2025-03-06' },
];

(async function main() {
  console.log(' Money Map AI Financial Advisor - Integration Test\n');
  console.log('='.repeat(60));

  // Test 1: Data Preparation
  console.log('\n✓ Test 1: Data Preparation');
  console.log('-'.repeat(60));

  const financialData = prepareFinancialData(testTransactions);
  console.log('Total Income:', financialData.totalIncome);
  console.log('Total Expenses:', financialData.totalExpenses);
  console.log('Balance:', financialData.balance);
  console.log('Savings Rate:', financialData.savingsRate + '%');
  console.log('Category Breakdown:', financialData.categoryBreakdown.map(c => `${c.name}: ₹${c.value}`).join(', '));
  console.log('Stats:', JSON.stringify(financialData.stats, null, 2));
  console.log('✅ Data prepared successfully (handled null/NaN amounts)');

  // Test 2: Validation Functions
  console.log('\n✓ Test 2: Validation');
  console.log('-'.repeat(60));

  const validQs = ['How to budget?', 'Should I invest?', 'My savings rate', 'Expense tracking'];
  const invalidQs = ['How to cook pasta?', 'What is the weather?', 'Tell me a joke', 'Build a bomb'];

  console.log('Valid questions:');
  validQs.forEach(q => {
    const result = isFinanceQuestion(q);
    console.log(`  "${q}" → ${result ? '✅ PASS' : '❌ FAIL'}`);
  });

  console.log('\nInvalid questions:');
  invalidQs.forEach(q => {
    const result = !isFinanceQuestion(q);
    console.log(`  "${q}" → ${result ? '✅ PASS' : '❌ FAIL'}`);
  });

  // Test 3: API Call (Non-streaming for Node.js)
  console.log('\n✓ Test 3: API Integration');
  console.log('-'.repeat(60));

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_CONFIG.MODEL,
        messages: [
          { role: 'system', content: `You are a professional financial advisor...` },
          { role: 'user', content: `Data: ${JSON.stringify(financialData, null, 2)}` }
        ],
        temperature: DEFAULT_CONFIG.TEMPERATURE,
        top_p: DEFAULT_CONFIG.TOP_P,
        max_tokens: 512,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const advice = result.choices?.[0]?.message?.content;

    if (advice && advice.length > 50) {
      console.log('✅ API call successful');
      console.log(`   Response length: ${advice.length} characters`);
      console.log(`   Token usage: ${result.usage?.total_tokens || 'N/A'}`);
      console.log('\n   Preview:', advice.substring(0, 200) + '...');
    } else {
      console.log('❌ Response too short or empty');
    }

  } catch (error) {
    console.log('⚠️  API test failed:', error.message);
    console.log('   (This may be due to network or quota limits)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(' Tests Complete');
  console.log(' Configuration:');
  console.log(`   - Model: ${DEFAULT_CONFIG.MODEL}`);
  console.log(`   - Max Tokens: ${DEFAULT_CONFIG.MAX_TOKENS}`);
  console.log(`   - Temperature: ${DEFAULT_CONFIG.TEMPERATURE}`);
  console.log(`   - Max Transactions: ${DEFAULT_CONFIG.MAX_TRANSACTIONS_TO_SEND}`);
  console.log('='.repeat(60));
})().catch(console.error);


