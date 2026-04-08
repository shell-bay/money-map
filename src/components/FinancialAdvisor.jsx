import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useTransactions } from '../hooks/useTransactions';
import { streamChatAdvisor, prepareFinancialData, DEFAULT_CONFIG, isFinanceQuestion } from '../services/nvidiaService';

/**
 * AI Financial Advisor component.
 * Streams real-time financial advice using Molder AI.
 *
 * Features:
 * - Auto-analysis of transaction data on load
 * - Custom Q&A with finance topic validation
 * - Request cancellation and retry
 * - Streaming display with markdown rendering
 *
 * @returns {JSX.Element} Advisor UI
 */
export default function FinancialAdvisor() {
  const { settings } = useSettings();
  const { transactions, loading } = useTransactions();
  const [advice, setAdvice] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState('');
  const [hasShown, setHasShown] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const abortControllerRef = useRef(null);

  // Build config from settings
  const config = useMemo(() => ({
    MODEL: settings.nvidiaModel,
    MAX_TOKENS: 1024,
    TEMPERATURE: 0.2,
    TOP_P: 0.7,
    MAX_TRANSACTIONS_TO_SEND: 50,
    FINANCE_KEYWORDS: DEFAULT_CONFIG.FINANCE_KEYWORDS
  }), [settings.nvidiaModel]);

  // Client-side finance question validation (matches backend)
  const isFinanceQuestion = useCallback((question) => {
    if (!question || !question.trim()) return true;
    const lower = question.toLowerCase();
    return config.FINANCE_KEYWORDS.some(keyword => lower.includes(keyword));
  }, [config.FINANCE_KEYWORDS]);

  // Memoized generate function to prevent re-renders
  const generateAdvice = useCallback(async (question = null) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    if (transactions.length === 0) {
      setAdvice('Add some transactions first to get personalized financial advice.');
      return;
    }

    // Validate question is finance-related before API call
    if (question && !isFinanceQuestion(question)) {
      setAdvice(DEFAULT_CONFIG.NON_FINANCE_RESPONSE);
      setError('');
      return;
    }

    setLoadingAi(true);
    setError('');
    setIsAsking(!!question);

    if (question) {
      setAdvice(''); // Clear previous advice for new question
    }

    try {
      // Prepare financial data using the same function as ChatAdvisor
      const financialData = prepareFinancialData(transactions, settings.currency, config);

      // Build conversation history for streaming chat
      const history = [];
      // streamChatAdvisor will build the system message with financial data internally
      // Just add the user question (or empty for auto-analysis)
      const userMessage = question || 'Please analyze my financial data and provide comprehensive advice.';
      history.push({ role: 'user', content: userMessage });

      const signal = abortControllerRef.current.signal;

      // Use streaming for better UX (via local backend proxy)
      let fullAdvice = '';
      const onChunk = (chunk) => {
        if (signal.aborted) return;
        fullAdvice += chunk;
        setAdvice(fullAdvice);
      };

      await streamChatAdvisor(history, financialData, config, onChunk, signal);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('AI request aborted');
        return;
      } else if (err.message === DEFAULT_CONFIG.NON_FINANCE_RESPONSE) {
        // streamChatAdvisor validation rejected non-finance question - show as normal response
        setAdvice(DEFAULT_CONFIG.NON_FINANCE_RESPONSE);
      } else {
        console.error('AI advice error:', err);
        setError(`Failed to get advice: ${err.message}`);
      }
    } finally {
      setLoadingAi(false);
      setIsAsking(false);
      abortControllerRef.current = null;
    }
  }, [transactions, settings.currency, config, isFinanceQuestion]);

  // Auto-generate advice once when data loads
  useEffect(() => {
    if (!hasShown && transactions.length > 0 && !loading) {
      generateAdvice();
      setHasShown(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length, loading]); // Only depend on length and loading, not full deps

  const handleAskQuestion = useCallback((e) => {
    e.preventDefault();
    const trimmedQuestion = userQuestion.trim();
    if (trimmedQuestion && !loadingAi) {
      generateAdvice(trimmedQuestion);
    }
  }, [userQuestion, loadingAi, generateAdvice]);

  const handleRetry = useCallback(() => {
    if (!loadingAi) {
      generateAdvice(userQuestion.trim() || null);
    }
  }, [userQuestion, loadingAi, generateAdvice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Parse markdown-like response for display (improved)
  const renderAdvice = useCallback((text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let inList = false;
    let keyIndex = 0;

    const flushList = () => {
      if (inList && currentList.length > 0) {
        elements.push(
          <ul key={`list-${keyIndex++}`} className="list-disc list-inside space-y-1.5 mb-3">
            {currentList.map((item, i) => (
              <li key={i} className="text-gray-700">{cleanListItem(item)}</li>
            ))}
          </ul>
        );
        currentList = [];
        inList = false;
      }
    };

    const cleanListItem = (text) => {
      // Remove markdown list markers: -, •, *, or "1. ", "2. ", etc.
      return text.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Skip empty lines at the start
      if (!trimmed && elements.length === 0) continue;

      // Check for markdown headers (### 1. Title)
      const headerMatch = trimmed.match(/^###\s+(.+)/);
      if (headerMatch) {
        flushList();
        const header = headerMatch[1].trim();
        elements.push(
          <h4 key={`h-${i}`} className="font-semibold text-gray-900 mb-2 mt-3 first:mt-0 text-sm uppercase tracking-wide text-gray-500">
            {header}
          </h4>
        );
        continue;
      }

      // Check for bullet points or numbered lists
      const isListItem = /^[-•*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);

      if (isListItem) {
        currentList.push(trimmed);
        inList = true;
        continue;
      }

      // Non-empty non-list text
      if (trimmed) {
        flushList();
        // Don't render single characters that might be stray bullet points
        if (trimmed.length > 1 || /[a-zA-Z0-9]/.test(trimmed)) {
          elements.push(
            <p key={`p-${i}`} className="text-gray-700 mb-2 leading-relaxed">
              {trimmed}
            </p>
          );
        }
      } else {
        // Empty line - flush the list
        flushList();
      }
    }

    flushList();

    return elements.length > 0 ? elements : (
      <p className="text-gray-700">{text}</p>
    );
  }, []);

  // No API key check needed - backend proxy handles authentication

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-xl shadow-sm p-6 border border-purple-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Financial Advisor</h3>
            <p className="text-xs text-gray-600">
              Powered by Molder AI • {transactions.length} transactions
            </p>
          </div>
        </div>
        <button
          onClick={() => generateAdvice()}
          disabled={loadingAi}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {loadingAi ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing...
            </>
          ) : (
            'Refresh Advice'
          )}
        </button>
      </div>

      {/* Question input */}
      <form onSubmit={handleAskQuestion} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            placeholder="Ask a specific finance question (optional)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
            disabled={loadingAi || isAsking}
          />
          <button
            type="submit"
            disabled={loadingAi || isAsking || !userQuestion.trim()}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAsking ? 'Sending...' : 'Ask'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="font-medium mb-1">Error</p>
          <p>{error}</p>
          <button
            onClick={handleRetry}
            disabled={loadingAi}
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium rounded transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loadingAi && (
        <div className="text-center py-6 text-gray-600">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <span>{isAsking ? 'Processing your question...' : 'Analyzing your financial data...'}</span>
          </div>
        </div>
      )}

      {/* Advice content */}
      {advice && !loadingAi && (
        <div className="prose prose-sm max-w-none">
          {renderAdvice(advice)}
        </div>
      )}

      {/* Empty state */}
      {!loadingAi && !advice && !error && (
        <div className="text-center py-6 text-gray-600">
          <svg className="w-12 h-12 text-purple-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="font-medium mb-1">Ready to analyze</p>
          <p className="text-sm text-gray-500">
            Click "Refresh Advice" or ask a question about your finances.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-purple-200">
        <p className="text-xs text-gray-500">
          Powered by Molder AI. Suggestions are AI-generated and for informational purposes only.
        </p>
      </div>
    </div>
  );
}
