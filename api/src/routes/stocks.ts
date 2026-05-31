import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';
import {
  ServiceError,
  getOrFetchStock,
  fetchIntraday,
  fetchStats,
  searchTickers,
  fetchNews,
  fetchRecommendations,
  fetchNewsSentiment,
  type StockStats,
  type AnalystRecommendation,
} from '../services/stockService.js';

const TICKER_RE = /^[A-Za-z0-9]{1,10}(\.[A-Za-z]{1,4})?$/;

type WithTicker = { Params: { ticker: string } };

/**
 * Wraps a route handler with ticker validation and uniform ServiceError → HTTP response mapping.
 * Unexpected errors are logged server-side; the client only sees a generic 500 message.
 */
function tickerRoute(
  handler: (req: FastifyRequest<WithTicker>, reply: FastifyReply) => Promise<unknown>
) {
  return async (req: FastifyRequest<WithTicker>, reply: FastifyReply) => {
    if (!TICKER_RE.test(req.params.ticker)) {
      return reply.status(400).send({ error: 'Invalid ticker format' });
    }
    try {
      return await handler(req, reply);
    } catch (err) {
      if (err instanceof ServiceError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      req.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

export async function stockRoutes(fastify: FastifyInstance): Promise<void> {
  // Autocomplete — must be registered before /:ticker to avoid route shadowing
  fastify.get('/api/stocks/search', async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q?.trim()) return reply.status(400).send({ error: 'Missing query parameter: q' });
    try {
      return await searchTickers(q.trim());
    } catch (err) {
      if (err instanceof ServiceError) return reply.status(err.statusCode).send({ error: err.message });
      req.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Daily OHLCV (PostgreSQL-cached)
  fastify.get('/api/stocks/:ticker', tickerRoute(async (req) => getOrFetchStock(req.params.ticker)));

  // Intraday intervals (always live, last 59 days)
  fastify.get('/api/stocks/:ticker/hourly', tickerRoute(async (req) => fetchIntraday(req.params.ticker, '1h')));
  fastify.get('/api/stocks/:ticker/30min',  tickerRoute(async (req) => fetchIntraday(req.params.ticker, '30min')));
  fastify.get('/api/stocks/:ticker/15min',  tickerRoute(async (req) => fetchIntraday(req.params.ticker, '15min')));

  // Live stats
  fastify.get('/api/stocks/:ticker/stats', tickerRoute(async (req) => fetchStats(req.params.ticker)));

  // News (raw)
  fastify.get('/api/stocks/:ticker/news', tickerRoute(async (req) => fetchNews(req.params.ticker)));

  // News + AI sentiment (OpenAI)
  fastify.get('/api/stocks/:ticker/news-sentiment', tickerRoute(async (req) => fetchNewsSentiment(req.params.ticker)));

  // Technical indicators (proxied to Python FastAPI service)
  fastify.get('/api/stocks/:ticker/indicators', tickerRoute(async (req) => {
    const svcUrl = process.env.PYTHON_SERVICE_URL;
    if (!svcUrl) throw new ServiceError(503, 'Indicator service not configured (missing PYTHON_SERVICE_URL)');
    const res = await fetch(`${svcUrl}/indicators/${req.params.ticker}`);
    if (res.status === 404) throw new ServiceError(404, `No indicator data for ${req.params.ticker}`);
    if (!res.ok) throw new ServiceError(502, 'Indicator service error');
    return res.json();
  }));

  // Analyst recommendations (Finnhub)
  fastify.get('/api/stocks/:ticker/recommendations', tickerRoute(async (req) => {
    const result = await fetchRecommendations(req.params.ticker);
    return result ?? null;
  }));

  // AI chatbot — streams SSE tokens grounded on live stock data
  fastify.post<{
    Params: { ticker: string };
    Body: { messages: Array<{ role: 'user' | 'assistant'; content: string }> };
  }>('/api/stocks/:ticker/chat', async (req, reply) => {
    if (!TICKER_RE.test(req.params.ticker)) {
      return reply.status(400).send({ error: 'Invalid ticker format' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return reply.status(503).send({ error: 'AI chat is not configured' });
    }

    const { messages } = req.body ?? {};
    if (!Array.isArray(messages)) {
      return reply.status(400).send({ error: 'messages must be an array' });
    }

    const ticker = req.params.ticker.toUpperCase();

    let statsData: StockStats;
    let sentimentResult: Awaited<ReturnType<typeof fetchNewsSentiment>>;
    let rec: AnalystRecommendation | null;

    try {
      [statsData, sentimentResult, rec] = await Promise.all([
        fetchStats(ticker),
        fetchNewsSentiment(ticker),
        fetchRecommendations(ticker),
      ]);
    } catch (err) {
      if (err instanceof ServiceError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      req.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }

    const sentiment = sentimentResult.overall;
    const headlines = sentimentResult.articles;

    const recLine = rec
      ? `Strong Buy: ${rec.strongBuy} | Buy: ${rec.buy} | Hold: ${rec.hold} | Sell: ${rec.sell} | Strong Sell: ${rec.strongSell}`
      : 'No analyst data available';

    const sentimentLine = sentiment
      ? `Overall Sentiment: ${sentiment.sentiment} (Confidence: ${sentiment.score}/100)\nSummary: ${sentiment.summary}`
      : 'No sentiment data available';

    const headlinesText = headlines.length > 0
      ? headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.source} (${h.publishedAt})`).join('\n')
      : 'No recent headlines available';

    const systemPrompt = `You are an expert stock analyst assistant for ${ticker} (${statsData.name}).
Your job is to help the user understand this stock using only the data provided below.
Today's date is ${new Date().toISOString().split('T')[0]}.

=== PRICE & STATS ===
Last Close: ${statsData.close ?? 'N/A'} ${statsData.currency}
Open: ${statsData.open ?? 'N/A'}
52-Week High: ${statsData.fiftyTwoWeekHigh ?? 'N/A'} ${statsData.currency}
52-Week Low: ${statsData.fiftyTwoWeekLow ?? 'N/A'} ${statsData.currency}
Total Volume: ${statsData.volume ?? 'N/A'}

=== ANALYST CONSENSUS ===
${recLine}

=== AI NEWS SENTIMENT ===
${sentimentLine}

=== RECENT HEADLINES (last 60 days) ===
${headlinesText}

=== INSTRUCTIONS ===
- Answer questions about this stock concisely and factually.
- Base your answers ONLY on the data provided above. Do not invent data.
- If you don't have enough data to answer confidently, say so explicitly.
- NEVER recommend buying, selling, or holding any stock. Always remind the user this is not financial advice.
- Keep responses focused and under 150 words unless a longer answer is clearly needed.`;

    // reply.hijack() bypasses Fastify's send path, so @fastify/cors headers
    // are never flushed to reply.raw — set CORS manually here.
    reply.raw.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? 'http://localhost:3000');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.hijack();
    reply.raw.flushHeaders();

    let streamStarted = false;

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const stream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      });

      streamStarted = true;

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (err) {
      req.log.error(err);
      try {
        reply.raw.write(`data: ${JSON.stringify({ error: streamStarted ? 'Stream interrupted' : 'Failed to start stream' })}\n\n`);
        reply.raw.end();
      } catch { /* connection already closed */ }
    }
  });
}
