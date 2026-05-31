from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from db import get_pool
from indicators import compute_indicators


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()   # warm-up connection pool on startup
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/indicators/{ticker}")
async def get_indicators(ticker: str):
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT ph.date::text, ph.close::float8
          FROM price_history ph
          JOIN stocks s ON s.id = ph.stock_id
         WHERE s.ticker = $1
         ORDER BY ph.date ASC
        """,
        ticker.upper(),
    )

    if not rows:
        raise HTTPException(status_code=404, detail=f"No price data for {ticker}")

    dates  = [r["date"]  for r in rows]
    closes = [r["close"] for r in rows]
    return compute_indicators(dates, closes)
