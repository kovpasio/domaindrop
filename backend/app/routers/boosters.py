from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserBooster
from app.schemas import BoosterActivateOut, BoosterOut, BoostersOut
from app.security import get_current_user
from app.services.boosters import promote_next_booster

router = APIRouter(prefix="/boosters", tags=["boosters"])


def _booster_out(booster: UserBooster) -> BoosterOut:
    return BoosterOut(
        id=int(booster.id),
        kind=booster.kind,
        percent=float(booster.percent),
        spins=int(booster.spins),
    )


async def _state(db: AsyncSession, user: User) -> BoostersOut:
    ready = (
        await db.scalars(
            select(UserBooster)
            .where(
                UserBooster.user_id == user.id,
                UserBooster.activated_at.is_(None),
                UserBooster.queued_at.is_(None),
            )
            .order_by(UserBooster.id.desc())
        )
    ).all()
    queued = (
        await db.scalars(
            select(UserBooster)
            .where(
                UserBooster.user_id == user.id,
                UserBooster.activated_at.is_(None),
                UserBooster.queued_at.is_not(None),
            )
            .order_by(UserBooster.queued_at.asc(), UserBooster.id.asc())
        )
    ).all()
    return BoostersOut(
        boosters=[_booster_out(row) for row in ready],
        queue=[_booster_out(row) for row in queued],
        active_percent=float(user.luck_boost_percent) if user.luck_boost_spins > 0 else 0,
        active_spins=int(user.luck_boost_spins),
    )


@router.get("", response_model=BoostersOut)
async def get_boosters(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoostersOut:
    return await _state(db, user)


@router.post("/{booster_id}/activate", response_model=BoosterActivateOut)
async def activate_booster(
    booster_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoosterActivateOut:
    locked = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    booster = await db.scalar(
        select(UserBooster)
        .where(
            UserBooster.id == booster_id,
            UserBooster.user_id == locked.id,
            UserBooster.activated_at.is_(None),
            UserBooster.queued_at.is_(None),
        )
        .with_for_update()
    )
    if booster is None:
        raise HTTPException(status_code=404, detail="Бустер не найден в инвентаре")

    queued = locked.luck_boost_spins > 0
    if queued:
        booster.queued_at = datetime.now(timezone.utc)
    else:
        locked.luck_boost_percent = max(
            float(locked.luck_boost_percent), float(booster.percent)
        )
        locked.luck_boost_spins = int(booster.spins)
        booster.activated_at = datetime.now(timezone.utc)
        await promote_next_booster(db, locked)
    await db.commit()
    await db.refresh(locked)
    await db.refresh(booster)
    return BoosterActivateOut(
        booster=_booster_out(booster),
        active_percent=float(locked.luck_boost_percent),
        active_spins=int(locked.luck_boost_spins),
        queued=queued,
    )
