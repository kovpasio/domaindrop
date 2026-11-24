from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserBooster


async def promote_next_booster(
    db: AsyncSession, user: User, now: datetime | None = None
) -> UserBooster | None:
    """Move the oldest queued booster into the single active slot."""
    if user.luck_boost_spins > 0:
        return None
    booster = await db.scalar(
        select(UserBooster)
        .where(
            UserBooster.user_id == user.id,
            UserBooster.activated_at.is_(None),
            UserBooster.queued_at.is_not(None),
        )
        .order_by(UserBooster.queued_at.asc(), UserBooster.id.asc())
        .limit(1)
        .with_for_update()
    )
    if booster is None:
        return None
    user.luck_boost_percent = float(booster.percent)
    user.luck_boost_spins = int(booster.spins)
    booster.activated_at = now or datetime.now(timezone.utc)
    return booster
