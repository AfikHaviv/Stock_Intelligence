import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { stockRoutes } from './routes/stocks';

dotenv.config();

const app = Fastify({ logger: true });

async function main() {
  const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  await app.register(cors, { origin: allowedOrigin });
  await app.register(stockRoutes);

  const port  = parseInt(process.env.PORT ?? '3001', 10);
  const host  = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
