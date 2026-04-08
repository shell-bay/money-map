import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Request ID middleware - generates unique ID for each request
app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Middleware
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Simple in-memory rate limiter for development
// Note: For production, use a distributed store like Redis
class SimpleRateLimiter {
  constructor(windowMs, max) {
    this.windowMs = windowMs;
    this.max = max;
    this.requests = new Map(); // ip -> [{timestamp}]
  }

  isAllowed(ip) {
    const now = Date.now();
    const requests = this.requests.get(ip) || [];

    // Remove old requests outside the window
    const recent = requests.filter(time => now - time < this.windowMs);

    if (recent.length >= this.max) {
      return false;
    }

    recent.push(now);
    this.requests.set(ip, recent);
    return true;
  }
}

const chatLimiter = new SimpleRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes

// Finance-related keywords for server-side validation
const FINANCE_KEYWORDS = [
  'finance', 'money', 'budget', 'saving', 'spending', 'expense', 'income',
  'invest', 'stock', 'bond', 'crypto', 'bank', 'loan', 'debt', 'credit',
  'tax', 'retirement', 'mortgage', 'rent', 'salary', 'pay', 'earn',
  'category', 'transaction', 'balance', 'cash flow', 'net worth', 'networth',
  'diversify', 'portfolio', 'asset', 'liability', 'equity', 'financial',
  'advice', 'suggestion', 'recommend', 'plan', 'goal', 'emergency'
];

function isFinanceQuestion(question) {
  if (!question || !question.trim()) return true; // Allow empty/analysis requests
  const lower = question.toLowerCase();
  return FINANCE_KEYWORDS.some(keyword => lower.includes(keyword));
}

// NVIDIA API configuration
const NVIDIA_API_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

if (!NVIDIA_API_KEY) {
  console.error('❌ NVIDIA_API_KEY is not set in environment variables');
  process.exit(1);
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  console.log(`[${req.requestId}] Health check requested`);
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Chat endpoint - proxies streaming requests to NVIDIA API
 * Expects JSON body:
 * {
 *   messages: [{role: 'system'|'user'|'assistant', content: string}],
 *   config: { MODEL, TEMPERATURE, TOP_P, MAX_TOKENS }
 * }
 */
app.post('/api/chat', async (req, res) => {
  // Rate limiting check
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  if (!chatLimiter.isAllowed(clientIp)) {
    console.warn(`[${req.requestId}] Rate limit exceeded for IP: ${clientIp}`);
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }

  try {
    const { messages, config } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Ensure system message exists and is first
    if (messages[0]?.role !== 'system') {
      return res.status(400).json({ error: 'First message must be a system message' });
    }

    // Validate that the last user message is finance-related
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage && !isFinanceQuestion(lastUserMessage.content)) {
      // Return polite refusal as a normal streaming response (200 OK) - not an error
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const refusalMessage = 'This is not a finance-related question. Kindly ask a different question about personal finance, budgeting, savings, or money management.';
      res.write(`data: ${JSON.stringify({ content: refusalMessage })}\n\n`);
      res.write('data: [DONE]\n\n');
      console.log(`[${req.requestId}] Non-finance question - polite refusal sent`);
      return;
    }

    // Call NVIDIA API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(NVIDIA_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model: config?.MODEL || 'meta/llama-3.3-70b-instruct',
          messages: messages,
          temperature: config?.TEMPERATURE ?? 0.2,
          top_p: config?.TOP_P ?? 0.7,
          max_tokens: config?.MAX_TOKENS ?? 1024,
          stream: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error(`[${req.requestId}] NVIDIA API request timeout:`, err.message);
        return res.status(504).json({
          error: 'Request timeout',
          message: 'The AI service took too long to respond. Please try again.'
        });
      }
      console.error(`[${req.requestId}] NVIDIA API fetch error:`, err);
      return res.status(500).json({
        error: 'Failed to connect to AI service',
        message: err.message
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[${req.requestId}] NVIDIA API error:`, {
        status: response.status,
        error: errorData
      });
      return res.status(response.status).json({
        error: `NVIDIA API error: ${response.status}`,
        details: errorData
      });
    }

    // Forward streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const decoder = new TextDecoder();

    try {
      // Use async iteration for better compatibility (works with node-fetch streams)
      if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
        for await (const chunk of response.body) {
          const text = decoder.decode(chunk);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (e) {
                // Skip malformed lines
              }
            }
          }
        }
      } else {
        // Fallback: read entire body as text (not ideal but works for non-streaming)
        const text = await response.text();
        res.write(text);
      }
      res.write('data: [DONE]\n\n');
      console.log(`[${req.requestId}] Request completed successfully`);
    } catch (err) {
      console.error(`[${req.requestId}] Streaming error:`, err);
      res.write(`data: ${JSON.stringify({ error: 'Streaming error' })}\n\n`);
    } finally {
      res.end();
    }

  } catch (error) {
    console.error(`[${req.requestId}] Chat endpoint error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend proxy server running on port ${PORT}`);
  console.log(`📡 Proxying to NVIDIA API`);
});
