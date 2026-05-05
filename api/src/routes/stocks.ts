import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getOrFetchStock, getHourlyData, get30MinData, get15MinData, getStockStats } from '../services/stockService';

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

export async function stockRoutes(app: FastifyInstance) {
  app.get('/api/stocks/:ticker',        tickerRoute(getOrFetchStock));
  app.get('/api/stocks/:ticker/hourly', tickerRoute(getHourlyData));
  app.get('/api/stocks/:ticker/30min',  tickerRoute(get30MinData));
  app.get('/api/stocks/:ticker/15min',  tickerRoute(get15MinData));
  app.get('/api/stocks/:ticker/stats',  tickerRoute(getStockStats));
}
