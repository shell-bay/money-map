import aiConfig from '../config/ai-advisor-config.json';

/**
 * NVIDIA NIM API service for AI-powered financial advice.
 * Now uses a local backend proxy to securely hide the API key.
 * All API calls go through the backend (no direct NVIDIA API key in frontend).
 *
 * @module nvidiaService
 */

// Use local backend proxy (API key stored securely in backend .env)
const NVIDIA_API_PROXY_ENDPOINT = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000/api/chat';

// Configuration merged with defaults (can be overridden per-call or via user settings)
const DEFAULT_CONFIG = {
  MODEL: aiConfig.model_settings.model,
  MAX_TOKENS: aiConfig.model_settings.max_tokens,
  TEMPERATURE: aiConfig.model_settings.temperature,
  TOP_P: aiConfig.model_settings.top_p,
  MAX_TRANSACTIONS_TO_SEND: aiConfig.model_settings.max_transactions_to_send,
  FINANCE_KEYWORDS: aiConfig.keywords,
  SYSTEM_PROMPT: aiConfig.system_prompt_template,
  NON_FINANCE_RESPONSE: aiConfig.non_finance_handling.response,
  ALLOWED_TOPICS: aiConfig.allowed_topics,
  DISALLOWED_TOPICS: aiConfig.disallowed_topics
};

/**
 * Merges user config with defaults
 */
function mergeConfig(userConfig = {}) {
  return { ...DEFAULT_CONFIG, ...userConfig };
}

/**
 * System prompt for the financial advisor AI
 * Enforces finance-only responses and structured output
 * @type {string}
 */
const FINANCIAL_ADVISOR_SYSTEM_PROMPT = `You are a professional financial advisor AI integrated into the Money Map app.

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
- [Acknowledge good financial habits]`;

/**
 * Prepares financial data for AI analysis.
 * Aggregates income, expenses, categories, and statistics from raw transactions.
 *
 * @param {Array<{type: string, amount: number|string, category?: string, date: string}>} transactions - Array of transaction objects
 * @param {string} currency - Currency code (e.g., 'INR', 'USD')
 * @param {Object} config - Configuration object with MAX_TRANSACTIONS_TO_SEND and other settings
 * @param {number} config.MAX_TRANSACTIONS_TO_SEND - Maximum number of recent transactions to include
 * @returns {Object} Prepared financial data summary
 * @property {number} totalIncome - Sum of all income transactions
 * @property {number} totalExpenses - Sum of all expense transactions
 * @property {number} balance - Income minus expenses
 * @property {number} savingsRate - Savings rate as percentage (0-100)
 * @property {Array<{name: string, value: number}>} categoryBreakdown - Expenses by category, sorted descending
 * @property {Array} recentTransactions - Limited number of recent transactions for AI context
 * @property {Object} stats - Additional metrics (transactionCount, avgTransaction, spikeCount, etc.)
 */
export function prepareFinancialData(transactions, currency = 'INR', config = DEFAULT_CONFIG) {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + validateAmount(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + validateAmount(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0;

  // Category breakdown (expenses only)
  const categoryMap = new Map();
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cat = t.category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + validateAmount(t.amount));
    });

  const categoryBreakdown = Array.from(categoryMap, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Detect spending spikes (transactions > 2x average)
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const avgTransaction = expenseTransactions.length > 0 ? totalExpenses / expenseTransactions.length : 0;
  const spikeTransactions = expenseTransactions.filter(t => validateAmount(t.amount) > avgTransaction * 2);

  // Weekend vs weekday spending
  const weekendSpending = expenseTransactions
    .filter(t => {
      const day = new Date(t.date).getDay();
      return day === 0 || day === 6;
    })
    .reduce((sum, t) => sum + validateAmount(t.amount), 0);

  const weekdaySpending = totalExpenses - weekendSpending;

  return {
    totalIncome,
    totalExpenses,
    balance,
    savingsRate: parseFloat(savingsRate),
    categoryBreakdown,
    recentTransactions: transactions.slice(0, config.MAX_TRANSACTIONS_TO_SEND),
    stats: {
      transactionCount: transactions.length,
      expenseCount: expenseTransactions.length,
      incomeCount: incomeTransactions.length,
      avgTransaction,
      spikeCount: spikeTransactions.length,
      weekendSpending,
      weekdaySpending
    },
    currency: currency || 'INR'
  };
}

/**
 * Validates and sanitizes a transaction amount.
 * Converts to float, returns 0 for any invalid input (null, undefined, NaN, non-numeric strings).
 * Prevents NaN propagation in financial calculations.
 *
 * @param {number|string|null|undefined} amount - Raw amount value
 * @returns {number} Sanitized numeric value (0 if invalid)
 */
function validateAmount(amount) {
  const num = parseFloat(amount);
  return isNaN(num) ? 0 : num;
}

/**
 * Validates if a user question is finance-related (simple keyword check).
 * Empty questions are allowed (trigger general financial analysis).
 *
 * @param {string} question - User's question text
 * @param {Object} config - Configuration with FINANCE_KEYWORDS array
 * @returns {boolean} True if question contains finance keywords or is empty, false otherwise
 */
export function isFinanceQuestion(question, config = DEFAULT_CONFIG) {
  if (!question || !question.trim()) return true; // General analysis always allowed

  const lowerQuestion = question.toLowerCase();
  // Combine both FINANCE_KEYWORDS and ALLOWED_TOPICS for comprehensive detection
  const financeKeywords = config.FINANCE_KEYWORDS || [];
  const allowedTopics = config.ALLOWED_TOPICS || [];
  const allKeywords = [...new Set([...financeKeywords, ...allowedTopics])];
  return allKeywords.some(keyword => lowerQuestion.includes(keyword));
}

/**
 * Streams a chat-based financial advisor response with conversation history.
 * Builds a messages array with system prompt containing financial data, then appends
 * the conversation history and latest user question.
 * Uses local backend proxy which holds the NVIDIA API key securely.
 *
 * @param {Array<{role: string, content: string}>} conversationHistory - Prior user/assistant messages (in order)
 * @param {Object} financialData - Prepared financial data from prepareFinancialData
 * @param {Object} config - Configuration with MODEL, TEMPERATURE, TOP_P, MAX_TOKENS, FINANCE_KEYWORDS
 * @param {Function} onChunk - Callback for each streaming content chunk: (chunk: string) => void
 * @param {AbortSignal} signal - AbortSignal to cancel the request
 * @returns {Promise<string>} Full concatenated response text
 * @throws {Error} If last message not finance-related, or network/proxy error
 */
export async function streamChatAdvisor(conversationHistory, financialData, config, onChunk, signal) {
  // Get the latest user message from history
  const lastUserMessage = conversationHistory.find(m => m.role === 'user');
  if (!lastUserMessage) {
    throw new Error('No user message provided.');
  }

  // Validate the latest question is finance-related
  if (!isFinanceQuestion(lastUserMessage.content, config)) {
    throw new Error(config.NON_FINANCE_RESPONSE || 'I can only help with financial and expense-related questions.');
  }

  const dataSummary = formatFinancialDataSummary(financialData);

  // Build system message with financial context
  const systemMessage = `${config.SYSTEM_PROMPT || FINANCIAL_ADVISOR_SYSTEM_PROMPT}\n\nUser Financial Data:\n${dataSummary}`;

  // Build full messages array for API
  // Limit conversation history to last 10 messages to stay within token limits
  const limitedHistory = conversationHistory.slice(-10);

  const messages = [
    { role: 'system', content: systemMessage },
    ...limitedHistory
  ];

  // Call local backend proxy (which holds the API key)
  const response = await fetch(NVIDIA_API_PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      messages: messages,
      config: {
        MODEL: config.MODEL,
        TEMPERATURE: config.TEMPERATURE,
        TOP_P: config.TOP_P,
        MAX_TOKENS: config.MAX_TOKENS
      }
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`AI service error: ${response.status} - ${error.error || error.message || 'Unknown error'}`);
  }

  // Handle streaming response (backend forwards NVIDIA's SSE format)
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            const json = JSON.parse(jsonStr);
            const content = json.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

/**
 * Formats financial data into a readable summary string for the AI prompt.
 * Includes totals, top categories, recent transactions, and key metrics.
 *
 * @param {Object} data - Prepared financial data object
 * @returns {string} Formatted summary text
 */
function formatFinancialDataSummary(data) {
  const { totalIncome, totalExpenses, balance, savingsRate, categoryBreakdown, recentTransactions, stats, currency } = data;
  const curr = currency || 'INR';

  return `
Financial Data Summary:
- Total Income: ${formatCurrency(totalIncome, curr)}
- Total Expenses: ${formatCurrency(totalExpenses, curr)}
- Balance: ${formatCurrency(balance, curr)}
- Savings Rate: ${savingsRate}%
- Transaction Count: ${stats.transactionCount}

Spending by Category (Top 6):
${categoryBreakdown.slice(0, 6).map(cat => `  • ${cat.name}: ${formatCurrency(cat.value, curr)} (${((cat.value / totalExpenses) * 100).toFixed(1)}%)`).join('\n')}
${categoryBreakdown.length > 6 ? `  • and ${categoryBreakdown.length - 6} more categories` : ''}

Recent Transactions (last 10):
${recentTransactions.slice(0, 10).map(t => `  • ${t.type === 'income' ? '+' : '-'} ${formatCurrency(validateAmount(t.amount), curr)} - ${t.category} (${t.date})`).join('\n')}
${recentTransactions.length > 10 ? `  • ... and ${recentTransactions.length - 10} more` : ''}

Key Metrics:
- Average transaction: ${formatCurrency(stats.avgTransaction, curr)}
- Spike transactions: ${stats.spikeCount}
- Weekend vs Weekday: ${formatCurrency(stats.weekendSpending, curr)} vs ${formatCurrency(stats.weekdaySpending, curr)}
`.trim();
}

/**
 * Formats a numeric amount as localized currency string with symbol.
 *
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - ISO currency code (INR, USD, EUR, etc.)
 * @returns {string} Formatted currency string (e.g., "₹1,234.56")
 */
function formatCurrency(amount, currencyCode = 'INR') {
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

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace(currencyCode, symbol);
}

// Export configuration and utilities for testing/advanced usage
export { DEFAULT_CONFIG, mergeConfig, validateAmount, formatCurrency, formatFinancialDataSummary };
