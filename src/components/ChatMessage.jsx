import React, { useMemo } from 'react';

/**
 * ChatMessage Component
 * Renders a single chat message bubble with markdown support.
 *
 * SECURITY NOTE: This component uses a custom markdown parser that renders only
 * React text elements (no HTML). This is XSS-safe because React automatically
 * escapes all text content. If switching to an HTML-generating markdown library
 * (e.g., react-markdown, marked), you MUST add DOMPurify sanitization.
 *
 * @param {Object} props
 * @param {'user' | 'assistant'} props.role - Sender role
 * @param {string} props.content - Message content (may contain markdown)
 * @param {boolean} [props.isStreaming] - Whether the message is currently streaming (shows cursor)
 * @returns {JSX.Element}
 */
export default function ChatMessage({ role, content, isStreaming = false }) {
  // Simple markdown parser (reuses logic from FinancialAdvisor)
  const renderedContent = useMemo(() => {
    if (!content) return null;

    const lines = content.split('\n');
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
        if (trimmed.length > 1 || /[a-zA-Z0-9]/.test(trimmed)) {
          elements.push(
            <p key={`p-${i}`} className="text-gray-700 mb-2 leading-relaxed">
              {trimmed}
            </p>
          );
        }
      } else {
        flushList();
      }
    }

    flushList();

    return elements.length > 0 ? elements : (
      <p className="text-gray-700">{content}</p>
    );
  }, [content]);

  // Determine bubble styling based on role
  const isUser = role === 'user';
  const bubbleClass = isUser
    ? 'bg-purple-600 text-white self-end rounded-br-none'
    : 'bg-gray-100 text-gray-800 self-start rounded-bl-none';

  return (
    <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${bubbleClass}`}>
      {renderedContent}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle" />
      )}
    </div>
  );
}
