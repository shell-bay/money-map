import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useTransactions } from '../hooks/useTransactions';
import { useBills } from '../hooks/useBills';
import { useNavigate } from 'react-router-dom';
import { prepareFinancialData, streamChatAdvisor, DEFAULT_CONFIG, isFinanceQuestion } from '../services/nvidiaService';
import ChatMessage from '../components/ChatMessage';
import { generateFinancialPrediction } from '../utils/financePredictions';

// Currency symbol mapping (same as in nvidiaService)
const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$'
};

export default function ChatAdvisor() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { transactions, loading: txLoading } = useTransactions();
  const { bills } = useBills();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]); // [{id, role, content}]
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Get currency symbol
  const currencySymbol = CURRENCY_SYMBOLS[settings.currency] || settings.currency || '₹';

  // Build config from settings with currency-aware system prompt
  const config = useMemo(() => ({
    MODEL: settings.nvidiaModel || DEFAULT_CONFIG.MODEL,
    MAX_TOKENS: 1024,
    TEMPERATURE: 0.2,
    TOP_P: 0.7,
    MAX_TRANSACTIONS_TO_SEND: 50,
    FINANCE_KEYWORDS: DEFAULT_CONFIG.FINANCE_KEYWORDS,
    // Inject currency symbol into system prompt
    SYSTEM_PROMPT: `${DEFAULT_CONFIG.SYSTEM_PROMPT}\n\nIMPORTANT CURRENCY INSTRUCTIONS:\n- The user's currency is ${settings.currency} (symbol: ${currencySymbol})\n- ALWAYS use the symbol "${currencySymbol}" when mentioning monetary amounts in your response\n- NEVER use ₹ unless the currency is INR\n- Format all numbers with the correct currency symbol`
  }), [settings.nvidiaModel, settings.currency, currencySymbol]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message to AI
  const sendMessage = useCallback(async (userMessage) => {
    if (transactions.length === 0) {
      setError(t('advisor.addTransactionsFirst'));
      return;
    }

    // Check for command (bypasses AI chat)
    const command = userMessage.trim();
    if (command === '/budget' || command === '/alerts' || command === '/savings' || command === '/prediction') {
      // Helper: get current month expenses by category
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthlyExpenses = {};
      const monthlyIncome = {};
      transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          if (tx.type === 'expense') {
            const cat = tx.category || t('transactionList.uncategorized');
            monthlyExpenses[cat] = (monthlyExpenses[cat] || 0) + Number(tx.amount);
          } else {
            const cat = tx.category || t('common.income');
            monthlyIncome[cat] = (monthlyIncome[cat] || 0) + Number(tx.amount);
          }
        }
      });
      const totalExpensesThisMonth = Object.values(monthlyExpenses).reduce((a,b)=>a+b,0);
      const totalIncomeThisMonth = Object.values(monthlyIncome).reduce((a,b)=>a+b,0);
      const savingsThisMonth = totalIncomeThisMonth - totalExpensesThisMonth;

      if (command === '/budget') {
        const { monthlyBudget, categoryBudgets } = settings;
        if (!monthlyBudget || Object.keys(categoryBudgets).length === 0) {
          setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'assistant',
            type: 'noBudget'
          }]);
          return;
        }
        const dateStr = now.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          type: 'budgetReport',
          data: {
            date: dateStr,
            monthlyBudget,
            totalExpenses: totalExpensesThisMonth,
            overallPct: monthlyBudget > 0 ? (totalExpensesThisMonth / monthlyBudget * 100).toFixed(1) : 0,
            categoryBudgets,
            monthlyExpenses
          }
        }]);
        return;
      }

      if (command === '/alerts') {
        const alerts = [];
        // Upcoming bills (next 3 days)
        const upcomingBills = bills.filter(b => {
          if (!b.isActive) return false;
          const due = new Date(b.nextDueDate);
          const today = new Date();
          const diff = Math.ceil((due - today) / (1000*60*60*24));
          return diff >= 0 && diff <= 3;
        });
        if (upcomingBills.length > 0) {
          const total = upcomingBills.reduce((sum, b) => sum + Number(b.amount), 0);
          alerts.push({ type: 'billAlert', values: { count: upcomingBills.length, amount: total } });
        }
        // Overspending categories (>80% of budget)
        if (settings.monthlyBudget > 0 && Object.keys(settings.categoryBudgets).length > 0) {
          Object.entries(settings.categoryBudgets).forEach(([cat, bud]) => {
            if (bud > 0) {
              const spent = monthlyExpenses[cat] || 0;
              const pct = (spent / bud) * 100;
              if (pct > 100) {
                alerts.push({ type: 'overspent', values: { category: cat, percent: pct, spent, budget: bud } });
              } else if (pct > 80) {
                alerts.push({ type: 'approachingLimit', values: { category: cat, percent: pct } });
              }
            }
          });
        }
        // Large transactions (>50% of monthly income)
        const largeTx = transactions.filter(t => t.type === 'expense' && t.amount > totalIncomeThisMonth * 0.5 && t.amount > 0);
        if (largeTx.length > 0) {
          alerts.push({ type: 'largeExpense', values: { count: largeTx.length } });
        }
        // Negative savings
        if (savingsThisMonth < 0) {
          alerts.push({ type: 'negativeSavings', values: { amount: Math.abs(savingsThisMonth) } });
        }
        if (alerts.length === 0) {
          alerts.push({ type: 'noAlerts' });
        }
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', type: 'alerts', data: { alerts } }]);
        return;
      }

      if (command === '/savings') {
        const savingsRateNum = totalIncomeThisMonth > 0 ? ((savingsThisMonth / totalIncomeThisMonth) * 100) : 0;
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          type: 'savings',
          data: {
            rate: savingsRateNum,
            income: totalIncomeThisMonth,
            expenses: totalExpensesThisMonth,
            savings: savingsThisMonth,
            adviceKey: savingsRateNum < 20 ? 'low' : 'good',
            neededAmount: savingsRateNum < 20 ? (totalIncomeThisMonth * 0.2) - savingsThisMonth : 0
          }
        }]);
        return;
      }

      if (command === '/prediction') {
        const prediction = generateFinancialPrediction(transactions, settings);
        // Post-process prediction to use correct currency symbol
        const processedPrediction = prediction.replace(/₹/g, currencySymbol);
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: processedPrediction
        }]);
        return;
      }
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Add user message to chat
    const userMsg = { id: Date.now(), role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setError(null);
    setInput('');

    // Client-side validation for finance-related questions
    if (!isFinanceQuestion(userMessage, config)) {
      setLoading(false);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', type: 'nonFinance' }]);
      abortControllerRef.current = null;
      return;
    }

    // Prepare financial data (re-calc fresh each time)
    const financialData = prepareFinancialData(transactions, settings.currency, config);

    // Create placeholder for assistant response
    const assistantMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    try {
      // Build conversation history: all messages including the one we just added
      const history = [...messages, userMsg];

      let fullResponse = '';
      await streamChatAdvisor(
        history,
        financialData,
        config,
        (chunk) => {
          // Replace any hardcoded ₹ with user's currency symbol
          const correctedChunk = chunk.replace(/₹/g, currencySymbol);
          fullResponse += correctedChunk;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId ? { ...msg, content: fullResponse } : msg
          ));
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('AI request aborted');
        // Remove the empty assistant message if aborted early
        setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
      } else if (err.message === DEFAULT_CONFIG.NON_FINANCE_RESPONSE) {
        // streamChatAdvisor validation rejected non-finance question - show as normal response
        setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', type: 'nonFinance' }]);
      } else {
        console.error('AI chat error:', err);
        setError(`Failed to get response: ${err.message}`);
        // Remove the empty assistant message on error
        setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, transactions, settings, config, bills, currencySymbol, i18n.language, t]);

  // Auto-analyze on mount if transactions exist
  useEffect(() => {
    if (!txLoading && transactions.length > 0 && messages.length === 0) {
      sendMessage(t('advisor.autoMessage'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txLoading, transactions.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !loading) {
      sendMessage(trimmed);
    }
  }, [input, loading, sendMessage]);

  const handleRetry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        // Remove last assistant message if exists and retry
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
          setMessages(prev => prev.slice(0, -1));
        }
        sendMessage(lastUserMsg.content);
      }
    }
  }, [messages, sendMessage]);

  // Reactive render helpers for command responses
  const renderBudgetReport = useCallback((data) => {
    const { date: dateStr, monthlyBudget, totalExpenses, overallPct, categoryBudgets, monthlyExpenses } = data;
    let response = `${t('advisor.budgetReport')} (${dateStr})\n\n`;
    response += `${t('common.totalExpenses', { default: 'Total Budget' })}: ${currencySymbol}${monthlyBudget.toLocaleString(i18n.language)}\n`;
    response += `${t('dashboard.totalExpenses')}: ${currencySymbol}${totalExpenses.toLocaleString(i18n.language)}\n`;
    response += `${t('common.overall')}: ${overallPct}% ${t('common.ofBudget')}\n\n`;
    response += `${t('budgetSettings.categoryBudgets')}:\n`;
    Object.entries(categoryBudgets).forEach(([cat, bud]) => {
      const spent = monthlyExpenses[cat] || 0;
      const pct = bud > 0 ? (spent / bud * 100).toFixed(1) : 0;
      const statusKey = pct > 100 ? 'over' : pct > 80 ? 'warn' : 'ok';
      response += `• ${cat}: ${currencySymbol}${spent.toLocaleString(i18n.language)} / ${currencySymbol}${bud.toLocaleString(i18n.language)} (${pct}%) ${t('advisor.budgetStatus.' + statusKey)}\n`;
    });
    return response;
  }, [t, i18n.language, currencySymbol]);

  const renderAlerts = useCallback((data) => {
    const { alerts } = data;
    const lines = alerts.map(alert => {
      switch (alert.type) {
        case 'billAlert':
          return t('advisor.billAlert', {
            count: alert.values.count,
            amount: `${currencySymbol}${alert.values.amount.toLocaleString(i18n.language)}`
          });
        case 'overspent':
          return t('advisor.overspentAlert', {
            category: alert.values.category,
            percent: alert.values.percent.toFixed(1),
            spent: `${currencySymbol}${alert.values.spent.toLocaleString(i18n.language)}`,
            budget: `${currencySymbol}${alert.values.budget.toLocaleString(i18n.language)}`
          });
        case 'approachingLimit':
          return t('advisor.approachingLimitAlert', {
            category: alert.values.category,
            percent: alert.values.percent.toFixed(1)
          });
        case 'largeExpense':
          return t('advisor.largeExpenseAlert', { count: alert.values.count });
        case 'negativeSavings':
          return t('advisor.negativeSavingsAlert', {
            amount: `${currencySymbol}${alert.values.amount.toLocaleString(i18n.language)}`
          });
        case 'noAlerts':
          return t('advisor.noAlerts');
        default:
          return '';
      }
    }).filter(Boolean);
    return t('advisor.alertsHeader') + '\n\n' + lines.join('\n');
  }, [t, i18n.language, currencySymbol]);

  const renderSavings = useCallback((data) => {
    const { rate, income, expenses, savings, adviceKey, neededAmount } = data;
    let response = `${t('advisor.savingsReport')}\n\n`;
    response += `${t('advisor.savingsRateReport', {
      rate: rate,
      income: `${currencySymbol}${income.toLocaleString(i18n.language)}`,
      expenses: `${currencySymbol}${expenses.toLocaleString(i18n.language)}`,
      savings: `${currencySymbol}${savings.toLocaleString(i18n.language)}`,
      advice: adviceKey === 'low' ? t('advisor.savingsAdviceLow', {
        amount: `${currencySymbol}${neededAmount.toLocaleString(i18n.language)}`
      }) : t('advisor.savingsAdviceGood')
    })}\n`;
    return response;
  }, [t, i18n.language, currencySymbol]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <p className="font-medium mb-1">{t('common.error')}</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={handleRetry}
                disabled={loading}
                className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium rounded transition"
              >
                {t('common.tryAgain')}
              </button>
            </div>
          )}

          {/* Empty state - no transactions */}
          {!txLoading && transactions.length === 0 && messages.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('advisor.noData')}</h3>
              <p className="text-gray-600 mb-6">{t('advisor.addTransactionsFirst')}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                data-tour="advisor-empty-dashboard-btn"
              >
                {t('common.goToDashboard')}
              </button>
            </div>
          )}

          {/* Loading state with no messages */}
          {txLoading && messages.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
              <p className="text-gray-600">{t('advisor.loadingTransactions')}</p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            let content = msg.content;
            if (msg.type === 'budgetReport') {
              content = renderBudgetReport(msg.data);
            } else if (msg.type === 'alerts') {
              content = renderAlerts(msg.data);
            } else if (msg.type === 'savings') {
              content = renderSavings(msg.data);
            } else if (msg.type === 'nonFinance') {
              content = t('advisor.nonFinanceResponse');
            } else if (msg.type === 'noBudget') {
              content = t('advisor.noBudget');
            }
            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <ChatMessage
                  role={msg.role}
                  content={content}
                  isStreaming={loading && msg.role === 'assistant' && msg.content === ''}
                />
              </div>
            );
          })}

          {/* Loading indicator while streaming */}
          {loading && messages[messages.length - 1]?.role === 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                  <span>{t('common.thinking')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Spacer for scroll */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2" data-tour="advisor-input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('advisor.placeholder')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
              disabled={loading}
              data-tour="advisor-input"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
              data-tour="advisor-send-btn"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                t('advisor.send')
              )}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {t('common.poweredBy')} • {t('common.transactionsLoaded', { count: transactions.length })}
          </p>
        </div>
      </footer>
    </div>
  );
}
