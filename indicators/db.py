import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # Neon requires SSL. Set DATABASE_SSL=true in the production environment.
        ssl = "require" if os.environ.get("DATABASE_SSL") == "true" else None
        _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"], ssl=ssl)
    return _pool
