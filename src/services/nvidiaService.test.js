/**
 * Unit tests for nvidiaService.js
 * Tests: prepareFinancialData, isFinanceQuestion, validateAmount, formatCurrency, formatFinancialDataSummary, streamChatAdvisor
 */

// Polyfill for TextDecoder/TextEncoder (Node.js doesn't have them by default)
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

import {
  prepareFinancialData,
  isFinanceQuestion,
  validateAmount,
  formatCurrency,
  formatFinancialDataSummary,
  DEFAULT_CONFIG,
  streamChatAdvisor
} from './nvidiaService';

describe('nvidiaService', () => {
  describe('validateAmount', () => {
    test('parses valid numbers', () => {
      expect(validateAmount(100)).toBe(100);
      expect(validateAmount('150.50')).toBe(150.5);
      expect(validateAmount(0)).toBe(0);
    });

    test('handles null/undefined as 0', () => {
      expect(validateAmount(null)).toBe(0);
      expect(validateAmount(undefined)).toBe(0);
    });

    test('handles invalid strings as 0', () => {
      expect(validateAmount('abc')).toBe(0);
      expect(validateAmount('xyz123')).toBe(0);
    });

    test('handles NaN', () => {
      expect(validateAmount(NaN)).toBe(0);
      expect(validateAmount('NaN')).toBe(0);
    });

    test('handles empty string as 0', () => {
      expect(validateAmount('')).toBe(0);
    });

    test('handles negative numbers', () => {
      expect(validateAmount(-100)).toBe(-100);
      expect(validateAmount('-50')).toBe(-50);
    });
  });

  describe('isFinanceQuestion', () => {
    const config = DEFAULT_CONFIG;

    test('returns true for empty or whitespace-only questions', () => {
      expect(isFinanceQuestion('')).toBe(true);
      expect(isFinanceQuestion('   ')).toBe(true);
      expect(isFinanceQuestion(null)).toBe(true);
      expect(isFinanceQuestion(undefined)).toBe(true);
    });

    test('identifies valid finance questions', () => {
      const valid = [
        'How to budget?',
        'Should I invest in stocks?',
        'My savings rate is low',
        'How to reduce expenses?',
        'What is my income?',
        'How to pay off my loan?',
        'Tax implications?',
        'Retirement planning advice',
        'My debt is too high',
        'Category breakdown',
        'Balance sheet analysis'
      ];
      valid.forEach(q => {
        expect(isFinanceQuestion(q, config)).toBe(true);
      });
    });

    test('blocks non-finance questions', () => {
      const invalid = [
        'How to cook pasta?',
        'What is the weather today?',
        'Tell me a joke',
        'How to build a bomb',
        'Latest movie recommendations',
        'Sports scores',
        'Who won the election?',
        'How to program in Python?'
      ];
      invalid.forEach(q => {
        expect(isFinanceQuestion(q, config)).toBe(false);
      });
    });

    test('is case-insensitive', () => {
      expect(isFinanceQuestion('BUDGET advice', config)).toBe(true);
      expect(isFinanceQuestion('SAVINGS tips', config)).toBe(true);
      expect(isFinanceQuestion('cook pasta', config)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    test('formats INR correctly', () => {
      const result = formatCurrency(1234.56, 'INR');
      expect(result).toContain('1,234.56');
      expect(result).toContain('₹');
    });

    test('formats USD correctly', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toContain('1,234.56');
      expect(result).toContain('$');
    });

    test('formats EUR correctly', () => {
      const result = formatCurrency(1234.56, 'EUR');
      expect(result).toContain('1,234.56');
      expect(result).toContain('€');
    });

    test('handles zero', () => {
      const result = formatCurrency(0, 'INR');
      expect(result).toBe('₹0.00');
    });

    test('handles negative numbers', () => {
      const result = formatCurrency(-5000, 'USD');
      expect(result).toContain('-');
      expect(result).toContain('5,000.00');
    });

    test('rounds to 2 decimal places', () => {
      const result = formatCurrency(1234.5678, 'INR');
      expect(result).not.toContain('5678');
      expect(result).toContain('1,234.57'); // includes comma
    });

    test('uses fallback for unknown currency', () => {
      const result = formatCurrency(1000, 'XYZ');
      expect(result).toContain('XYZ');
    });
  });

  describe('prepareFinancialData', () => {
    const defaultConfig = DEFAULT_CONFIG;

    test('calculates totals correctly', () => {
      const transactions = [
        { type: 'income', amount: 50000, category: 'Salary', date: '2025-03-01' },
        { type: 'expense', amount: 15000, category: 'Rent', date: '2025-03-02' },
        { type: 'expense', amount: 5000, category: 'Food', date: '2025-03-03' }
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.totalIncome).toBe(50000);
      expect(result.totalExpenses).toBe(20000);
      expect(result.balance).toBe(30000);
      expect(result.savingsRate).toBeCloseTo(60, 1);
    });

    test('handles null/undefined/NaN amounts', () => {
      const transactions = [
        { type: 'income', amount: 10000, category: 'Salary', date: '2025-03-01' },
        { type: 'expense', amount: null, category: 'Food', date: '2025-03-02' },
        { type: 'expense', amount: undefined, category: 'Rent', date: '2025-03-03' },
        { type: 'expense', amount: 'invalid', category: 'Other', date: '2025-03-04' },
        { type: 'expense', amount: NaN, category: 'Other', date: '2025-03-05' }
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.totalIncome).toBe(10000);
      expect(result.totalExpenses).toBe(0); // All invalid amounts treated as 0
      expect(result.balance).toBe(10000);
    });

    test('creates category breakdown correctly', () => {
      const transactions = [
        { type: 'expense', amount: 3000, category: 'Food', date: '2025-03-01' },
        { type: 'expense', amount: 2000, category: 'Food', date: '2025-03-02' },
        { type: 'expense', amount: 1000, category: 'Transport', date: '2025-03-03' },
        { type: 'expense', amount: 500, category: 'Utilities', date: '2025-03-04' }
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.categoryBreakdown).toHaveLength(3);
      expect(result.categoryBreakdown[0]).toEqual({ name: 'Food', value: 5000 });
      expect(result.categoryBreakdown[1]).toEqual({ name: 'Transport', value: 1000 });
      expect(result.categoryBreakdown[2]).toEqual({ name: 'Utilities', value: 500 });
    });

    test('sorts categories by value (descending)', () => {
      const transactions = [
        { type: 'expense', amount: 100, category: 'A', date: '2025-03-01' },
        { type: 'expense', amount: 500, category: 'B', date: '2025-03-02' },
        { type: 'expense', amount: 300, category: 'C', date: '2025-03-03' }
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.categoryBreakdown[0].name).toBe('B');
      expect(result.categoryBreakdown[1].name).toBe('C');
      expect(result.categoryBreakdown[2].name).toBe('A');
    });

    test('handles uncategorized expenses', () => {
      const transactions = [
        { type: 'expense', amount: 1000, category: null, date: '2025-03-01' },
        { type: 'expense', amount: 2000, category: undefined, date: '2025-03-02' }
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.categoryBreakdown).toHaveLength(1);
      expect(result.categoryBreakdown[0].name).toBe('Uncategorized');
      expect(result.categoryBreakdown[0].value).toBe(3000);
    });

    test('limits recent transactions to MAX_TRANSACTIONS_TO_SEND', () => {
      const manyTransactions = Array.from({ length: 100 }, (_, i) => ({
        type: 'expense',
        amount: 100,
        category: 'Test',
        date: `2025-03-${String(i + 1).padStart(2, '0')}`
      }));
      const result = prepareFinancialData(manyTransactions, 'INR', defaultConfig);

      expect(result.recentTransactions).toHaveLength(defaultConfig.MAX_TRANSACTIONS_TO_SEND);
    });

    test('calculates stats correctly', () => {
      const transactions = [
        { type: 'income', amount: 50000, category: 'Salary', date: '2025-03-01' },
        { type: 'expense', amount: 1000, category: 'Food', date: '2025-03-02' },
        { type: 'expense', amount: 2000, category: 'Rent', date: '2025-03-03' },
        { type: 'expense', amount: 10000, category: 'Big', date: '2025-03-04' } // 10x avg
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.stats.transactionCount).toBe(4);
      expect(result.stats.expenseCount).toBe(3);
      expect(result.stats.avgTransaction).toBeCloseTo(4333.33, 1);
      expect(result.stats.spikeCount).toBe(1); // The 10000 transaction
    });

    test('handles empty transaction list', () => {
      const result = prepareFinancialData([], 'INR', defaultConfig);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.balance).toBe(0);
      expect(result.savingsRate).toBe(0);
      expect(result.categoryBreakdown).toHaveLength(0);
      expect(result.recentTransactions).toHaveLength(0);
    });

    test('handles no income (zero savings rate)', () => {
      const transactions = [
        { type: 'expense', amount: 5000, category: 'Food', date: '2025-03-01' }
      ];
      const result = prepareFinancialData(transactions, 'INR', defaultConfig);

      expect(result.totalIncome).toBe(0);
      expect(result.savingsRate).toBe(0);
    });
  });

  describe('formatFinancialDataSummary', () => {
    test('formats summary correctly', () => {
      const financialData = {
        totalIncome: 50000,
        totalExpenses: 20000,
        balance: 30000,
        savingsRate: 60.0,
        categoryBreakdown: [
          { name: 'Rent', value: 15000 },
          { name: 'Food', value: 3000 },
          { name: 'Transport', value: 2000 }
        ],
        recentTransactions: [
          { type: 'income', amount: 50000, category: 'Salary', date: '2025-03-01' },
          { type: 'expense', amount: 15000, category: 'Rent', date: '2025-03-02' }
        ],
        stats: {
          transactionCount: 10,
          expenseCount: 9,
          incomeCount: 1,
          avgTransaction: 2500,
          spikeCount: 0,
          weekendSpending: 5000,
          weekdaySpending: 15000
        }
      };
      const result = formatFinancialDataSummary(financialData);

      expect(result).toContain('Total Income:');
      expect(result).toContain('Total Expenses:');
      expect(result).toContain('Balance:');
      expect(result).toContain('Savings Rate:');
      expect(result).toContain('Spending by Category');
      expect(result).toContain('Recent Transactions');
      expect(result).toContain('Key Metrics');
    });

    test('shows "and X more" when more than 6 categories', () => {
      const financialData = {
        totalIncome: 100000,
        totalExpenses: 80000,
        balance: 20000,
        savingsRate: 20,
        categoryBreakdown: Array.from({ length: 10 }, (_, i) => ({
          name: `Category ${i}`,
          value: 8000
        })),
        recentTransactions: [],
        stats: {
          transactionCount: 10,
          expenseCount: 10,
          incomeCount: 0,
          avgTransaction: 8000,
          spikeCount: 0,
          weekendSpending: 4000,
          weekdaySpending: 4000
        }
      };
      const result = formatFinancialDataSummary(financialData);

      expect(result).toContain('and 4 more categories');
    });
  });

  describe('streamChatAdvisor', () => {
    // Mock fetch globally
    let mockFetch;
    const mockConfig = DEFAULT_CONFIG;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = jest.fn();
    });

    test('throws error if conversation history is empty', async () => {
      const financialData = prepareFinancialData([], 'INR', mockConfig);
      const onChunk = jest.fn();

      await expect(streamChatAdvisor([], financialData, mockConfig, onChunk, new AbortController().signal))
        .rejects.toThrow('No user message provided.');
    });

    test('validates last user message is finance-related', async () => {
      const financialData = prepareFinancialData([], 'INR', mockConfig);
      const onChunk = jest.fn();

      // Non-finance question
      const history = [{ role: 'user', content: 'How to cook pasta?' }];

      await expect(streamChatAdvisor(history, financialData, mockConfig, onChunk, new AbortController().signal))
        .rejects.toThrow('This is not a finance-related question. Kindly ask a different question about personal finance, budgeting, savings, or money management.');
    });

    test('builds correct messages array with system and history, calls backend proxy', async () => {
      const transactions = [
        { type: 'income', amount: 50000, category: 'Salary', date: '2025-03-01' },
        { type: 'expense', amount: 15000, category: 'Rent', date: '2025-03-02' }
      ];
      const financialData = prepareFinancialData(transactions, 'INR', mockConfig);
      const onChunk = jest.fn();

      const history = [
        { role: 'user', content: 'What is my savings rate?' },
        { role: 'assistant', content: 'Your savings rate is 60%.' },
        { role: 'user', content: 'How can I improve it?' }
      ];

      // Create a mock reader that sends one chunk then finishes
      const encoder = new TextEncoder();
      const chunkData = encoder.encode('data: {"content":"OK"}\n');
      let readCalled = false;
      const mockReader = {
        read: async () => {
          if (readCalled) {
            return { done: true, value: undefined };
          }
          readCalled = true;
          return { done: false, value: chunkData };
        },
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader
        },
        json: async () => ({ choices: [{ message: { content: 'OK' } }] })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await streamChatAdvisor(history, financialData, mockConfig, onChunk, new AbortController().signal);

      // Verify fetch was called to backend proxy
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:5000/api/chat'); // Backend proxy endpoint

      const body = JSON.parse(options.body);
      expect(body.messages).toHaveLength(4); // system + 3 history messages
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('Financial Data Summary');
      expect(body.messages[1]).toEqual({ role: 'user', content: 'What is my savings rate?' });
      expect(body.messages[2]).toEqual({ role: 'assistant', content: 'Your savings rate is 60%.' });
      expect(body.messages[3]).toEqual({ role: 'user', content: 'How can I improve it?' });

      // Verify streaming worked (backend forwards SSE with {content} format)
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('OK');
      expect(result).toBe('OK');
    });

    test('handles backend error response', async () => {
      const financialData = prepareFinancialData([], 'INR', mockConfig);
      const onChunk = jest.fn();

      const history = [{ role: 'user', content: 'What is my budget?' }];

      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Backend error' })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(streamChatAdvisor(history, financialData, mockConfig, onChunk, new AbortController().signal))
        .rejects.toThrow('AI service error: 500 - Backend error');
    });

    test('limits conversation history to last 10 messages', async () => {
      const financialData = prepareFinancialData([], 'INR', mockConfig);
      const onChunk = jest.fn();

      // Create 13 message history (6 full exchanges + 1 extra user)
      const history = [];
      for (let i = 0; i < 6; i++) {
        history.push({ role: 'user', content: `Question about budget ${i}` });
        history.push({ role: 'assistant', content: `Answer ${i}` });
      }
      history.push({ role: 'user', content: 'How to save more?' });

      const mockReader = {
        read: async () => ({ done: true, value: undefined }),
        releaseLock: jest.fn()
      };
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader
        },
        json: async () => ({ choices: [{ message: { content: 'OK' } }] })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await streamChatAdvisor(history, financialData, mockConfig, onChunk, new AbortController().signal);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Should include system + last 10 messages from history (out of 13 total)
      expect(body.messages).toHaveLength(11); // 1 system + 10 history
      // With 13 items total, slice(-10) starts at index 3, which is "Answer 1"
      const firstHistoryMsgInRequest = body.messages[1];
      expect(firstHistoryMsgInRequest.content).toBe('Answer 1'); // dropped Q0, A0, Q1
    });
  });
});
