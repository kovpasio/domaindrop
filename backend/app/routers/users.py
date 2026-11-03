from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.economy import daily_bonus_for
from app.models import User
from app.schemas import DailyBonusOut, LuckProgressOut, MeOut, MeStats, UserOut
from app.security import get_current_user
from app.services.luck import luck_profile
from app.services.stats import (
    collection_breakdown,
    collection_stats,
    total_players,
    user_rank,
)

router = APIRouter(tags=["profile"])


def _as_utc(value: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; Postgres does not. Keep comparisons safe for both."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def build_me(db: AsyncSession, user: User) -> MeOut:
    collection_count, collection_value = await collection_stats(db, user.id)
    by_rarity = await collection_breakdown(db, user.id)
    rank = await user_rank(db, user.id)
    players = await total_players(db)
    now = datetime.now(timezone.utc)
    last_bonus = _as_utc(user.last_daily_bonus)
    next_bonus = (
        last_bonus + timedelta(hours=settings.daily_cooldown_hours)
        if last_bonus
        else None
    )
    can_daily = next_bonus is None or now >= next_bonus
    progress = luck_profile(user.total_spins, by_rarity)
    return MeOut(
        user=UserOut.model_validate(user),
        progress=LuckProgressOut(
            level=progress.level,
            title=progress.title,
            total_spins=progress.total_spins,
            next_level_spins=progress.next_level_spins,
            spins_into_level=progress.spins_into_level,
            spins_to_next=progress.spins_to_next,
            level_luck=progress.level_luck,
            inventory_luck=progress.inventory_luck,
            total_luck=progress.total_luck,
        ),
        stats=MeStats(
            collection_count=collection_count,
            collection_value=collection_value,
            collection_by_rarity=by_rarity,
            rank=rank or None,
            total_players=players,
            daily_bonus=daily_bonus_for(
                user.balance,
                settings.daily_bonus_percent,
                settings.daily_bonus_max,
            ),
            daily_available_at=next_bonus,
            can_daily_bonus=can_daily,
        ),
    )


@router.get("/me", response_model=MeOut)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    return await build_me(db, user)


@router.post("/daily-bonus", response_model=DailyBonusOut)
async def claim_daily_bonus(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyBonusOut:
    locked = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    now = datetime.now(timezone.utc)
    last_bonus = _as_utc(locked.last_daily_bonus)
    if last_bonus is not None:
        next_at = last_bonus + timedelta(hours=settings.daily_cooldown_hours)
        if now < next_at:
            retry_after = max(1, int((next_at - now).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail="Ежедневный бонус уже получен",
                headers={"Retry-After": str(retry_after)},
            )

    amount = daily_bonus_for(
        locked.balance,
        settings.daily_bonus_percent,
        settings.daily_bonus_max,
    )
    locked.last_daily_bonus = now
    locked.balance += amount
    await db.commit()
    await db.refresh(locked)

    return DailyBonusOut(
        rewarded=True,
        amount=amount,
        balance=locked.balance,
        next_available_at=now + timedelta(hours=settings.daily_cooldown_hours),
        user=UserOut.model_validate(locked),
    )
