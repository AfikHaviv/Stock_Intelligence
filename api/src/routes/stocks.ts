import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getOrFetchStock, getHourlyData, get30MinData, get15MinData, getStockStats, searchTickers, getStockNews } from '../services/stockService';

const TICKER_RE = /^[A-Za-z0-9]{1,10}(\.[A-Za-z]{1,4})?$/;

type Handler = (ticker: string) => Promise<unknown>;
type TickerReq = FastifyRequest<{ Params: { ticker: string } }>;

function tickerRoute(handler: Handler) {
  return async (req: TickerReq, reply: FastifyReply) => {
    const { ticker } = req.params;
    if (!TICKER_RE.test(ticker)) return reply.status(400).send({ error: 'Invalid ticker' });
    try {
      return reply.send(await handler(ticker));
    } catch (e) {
      // Log internally; never forward raw messages to the client
      console.error('[stock route error]', e instanceof Error ? e.message : e);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

type SearchReq = FastifyRequest<{ Querystring: { q?: string } }>;

export async function stockRoutes(app: FastifyInstance) {
  // Static route must be registered before /:ticker to take priority
  app.get('/api/stocks/search', async (req: SearchReq, reply) => {
    const q = (req.query.q ?? '').trim();
    if (!q)        return reply.send([]);
    if (q.length > 50) return reply.status(400).send({ error: 'Query too long' });
    try {
      return reply.send(await searchTickers(q));
    } catch (e) {
      console.error('[search error]', e instanceof Error ? e.message : e);
      return reply.status(500).send({ error: 'Search failed' });
    }
  });

  app.get('/api/stocks/:ticker',        tickerRoute(getOrFetchStock));
  app.get('/api/stocks/:ticker/hourly', tickerRoute(getHourlyData));
  app.get('/api/stocks/:ticker/30min',  tickerRoute(get30MinData));
  app.get('/api/stocks/:ticker/15min',  tickerRoute(get15MinData));
  app.get('/api/stocks/:ticker/stats',  tickerRoute(getStockStats));
  app.get('/api/stocks/:ticker/news',   tickerRoute(getStockNews));
}
