import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { stockRoutes } from './routes/stocks.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: CORS_ORIGIN });
await fastify.register(stockRoutes);

try {
  await fastify.listen({ port: PORT, host: HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
