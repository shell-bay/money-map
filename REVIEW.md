# AI Financial Advisor - Code Review

## Issues Found

### 🔴 CRITICAL

1. **Memory Leak - Stream Not Cancelled on Unmount**
   - Location: `FinancialAdvisor.jsx:31-38`
   - Issue: `getFinancialAdviceStream` starts a fetch but there's no AbortController to cancel it if component unmounts
   - Risk: Attempting to set state on unmounted component, memory leak
   - Fix: Add AbortController and cleanup in useEffect

2. **Infinite Re-render Risk**
   - Location: `FinancialAdvisor.jsx:18-20`
   - Issue: `generateAdvice` is defined inline and calls `setHasShown(true)`, which could trigger re-render
   - Fix: Wrap generateAdvice in useCallback with proper dependencies

### 🟡 HIGH

3. **No User Input Validation**
   - Location: `FinancialAdvisor.jsx:57` (handleAskQuestion)
   - Issue: No validation that userQuestion is finance-related before sending
   - Risk: User can ask "how to build a bomb" and it goes to API
   - Fix: Add client-side validation before API call

4. **Race Condition - Multiple Concurrent Requests**
   - Location: `FinancialAdvisor.jsx:30-38`
   - Issue: If user clicks "Refresh" while question is processing, both could interleave
   - Fix: Add request ID or queue mechanism

5. **Missing Error Recovery**
   - Location: `FinancialAdvisor.jsx:196`
   - Issue: Error state has no retry button
   - Fix: Add "Retry" button when error occurs

### 🟢 MEDIUM

6. **Poor Markdown Parsing**
   - Location: `FinancialAdvisor.jsx:83-130`
   - Issue: Regex-based markdown parser is fragile and could break on edge cases
   - Fix: Use a proper markdown library or improve regex

7. **No Streaming in Node.js Environment**
   - Location: `test_streaming.js` and service
   - Issue: Streaming code doesn't work in Node.js (but works in browser)
   - Fix: Add environment detection or separate implementations

8. **Missing TypeScript/JSDoc**
   - Issue: No type hints or documentation for function signatures
   - Fix: Add JSDoc comments

### 🟢 LOW

9. **Missing Telemetry**
   - Issue: No logging of API calls for debugging
   - Fix: Add optional logging

10. **Hard-coded Model**
    - Location: `nvidiaService.js:multiple`
    - Issue: Model name is hard-coded; should be configurable
    - Fix: Move to env variable or settings

## Security Concerns

1. **API Key Exposure**
   - ✅ Current: Key stored in Settings (localStorage) - client-side only
   - Risk: User's API key is exposed to their browser
   - Mitigation: This is by design for a client-side app. Document that users should use their own keys.

2. **Prompt Injection**
   - ⚠️ Current: User question directly concatenated into prompt
   - Risk: User could try to override system prompt
   - Mitigation: System prompt is passed as separate message, so user cannot override it in OpenAI format

3. **Content Safety**
   - ✅ Llama Guard is not being used; instead using general chat model
   - Should consider adding an additional safety layer or using a safety classifier

## Performance Issues

1. **Real-time Firestore Listener**
   - ✅ This is correct for real-time updates
   - But: Might be excessive if user only wants AI occasionally
   - No action needed - it's already optimal

2. **Streaming Rendering**
   - ✅ Good UX - user sees text as it generates
   - But: Frequent re-renders could be expensive
   - Consider: Debounce or batch updates

## Edge Cases Not Handled

1. **Empty or NaN financial data**
   - If transactions have invalid amounts, could produce NaN in calculations
   - Current: `parseFloat(t.amount || 0)` handles null/undefined but not "abc"
   - Add: Validation that amount is a valid number

2. **Extremely large transaction sets**
   - prepareFinancialData processes all transactions client-side
   - Could be slow with 1000+ transactions
   - Consider: Pagination or server-side processing

3. **Multiple currencies mixed**
   - Current: assumes all transactions in same currency
   - Could produce wrong formatting if mixed

4. **Timezone issues**
   - Weekend calculation uses local timezone of user's device
   - This is actually correct for user's context

## Code Quality Issues

1. **Missing useCallback**
   - generateAdvice should be memoized to avoid unnecessary re-renders

2. **Arrow function in JSX**
   - handleAskQuestion is inline arrow in form onSubmit
   - Should be extracted or useCallback

3. **Duplicate logic**
   - parseMarkdown code could be extracted to utility

4. **Magic numbers**
   - "50" transactions sent to AI - should be constant with explanation

## Testing Gaps

1. **No unit tests** for nvidiaService.js
2. **No integration tests** for FinancialAdvisor component
3. **No error scenario tests** (API down, invalid key, etc.)
4. **No streaming tests** that verify chunk handling

## Recommendations Priority

### P0 (Fix Immediately)
- Add AbortController for streaming cancellation
- Wrap generateAdvice in useCallback

### P1 (Fix Soon)
- Add user question validation (finance-only check on client)
- Add retry button for errors
- Add request queuing to prevent concurrent calls

### P2 (Nice to have)
- Replace markdown parser with library (e.g., react-markdown)
- Add JSDoc
- Add model config to settings
- Add telemetry/logging

### P3 (Future)
- Add unit tests
- Add edge case validation in prepareFinancialData
- Implement request deduplication
