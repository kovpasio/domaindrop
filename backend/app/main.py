from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal, close_db, init_db
from app.routers import (
    achievements,
    admin,
    auth,
    cases,
    domains,
    drops,
    earnings,
    frames,
    inventory,
    leaderboard,
    settings as settings_router,
    spins,
    tasks,
    theme,
    upgrades,
    users,
)
from app.schemas import HealthOut
from app.services.realtime import redis_drops_listener
from app.services.redis_client import close_redis, ping_redis, redis_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    redis_ok = await ping_redis()
    logger.info("Redis connected: %s", redis_ok)

    stop_event = asyncio.Event()
    listener = asyncio.create_task(redis_drops_listener(stop_event))
    app.state.drops_listener = listener
    logger.info("%s started", settings.app_name)
    try:
        yield
    finally:
        stop_event.set()
        listener.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await listener
        await close_redis()
        await close_db()


app = FastAPI(
    title="Domain Drop API",
    description="Telegram Mini App: виртуальная рулетка доменов.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(domains.router, prefix=api_prefix)
app.include_router(spins.router, prefix=api_prefix)
app.include_router(inventory.router, prefix=api_prefix)
app.include_router(leaderboard.router, prefix=api_prefix)
app.include_router(drops.router, prefix=api_prefix)
app.include_router(earnings.router, prefix=api_prefix)
app.include_router(settings_router.router, prefix=api_prefix)
app.include_router(upgrades.router, prefix=api_prefix)
app.include_router(tasks.router, prefix=api_prefix)
app.include_router(achievements.router, prefix=api_prefix)
app.include_router(frames.router, prefix=api_prefix)
app.include_router(theme.router, prefix=api_prefix)
app.include_router(cases.router, prefix=api_prefix)


@app.get("/api/health", response_model=HealthOut, tags=["system"])
async def health() -> HealthOut:
    database_status = "ok"
    redis_status = "ok"
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        database_status = "error"
    try:
        if not await redis_client.ping():
            redis_status = "error"
    except Exception:
        redis_status = "error"
    return HealthOut(
        status="ok" if database_status == "ok" else "degraded",
        database=database_status,
        redis=redis_status,
    )


@app.get("/api", tags=["system"])
async def api_root() -> dict:
    return {
        "name": "Domain Drop API",
        "docs": "/api/docs",
        "environment": settings.environment,
    }
