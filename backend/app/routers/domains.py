from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.economy import (
    SPIN_TYPES,
    ZONES,
    rarity_payload,
    spin_types_payload,
    upgrade_sectors_payload,
)
from app.models import Domain, User
from app.schemas import DomainOut, MetaOut, RollTypeOut, UpgradeSectorOut
from app.security import get_current_user

router = APIRouter(tags=["catalog"])


@router.get("/domains", response_model=list[DomainOut])
async def list_domains(
    zone: str | None = Query(default=None),
    rarity: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DomainOut]:
    stmt = (
        select(Domain)
        .where(Domain.is_available.is_(True))
        .order_by(Domain.id)
        .limit(limit)
        .offset(offset)
    )
    if zone:
        stmt = stmt.where(Domain.zone == zone)
    if rarity:
        stmt = stmt.where(Domain.rarity == rarity)
    domains = (await db.scalars(stmt)).all()
    return [DomainOut.model_validate(domain) for domain in domains]


@router.get("/domains/feed", response_model=list[DomainOut])
async def domain_feed(
    roll_type: str = Query(default="normal"),
    limit: int = Query(default=60, ge=10, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DomainOut]:
    roll = SPIN_TYPES.get(roll_type)
    if roll is None:
        raise HTTPException(status_code=422, detail="Неизвестный тип рулетки")
    domains = (
        await db.scalars(
            select(Domain)
            .where(
                Domain.is_available.is_(True),
                Domain.rarity.in_(roll["rarities"]),
            )
            .order_by(func.random())
            .limit(limit)
        )
    ).all()
    return [DomainOut.model_validate(domain) for domain in domains]


@router.get("/meta", response_model=MetaOut)
async def get_meta(db: AsyncSession = Depends(get_db)) -> MetaOut:
    total_domains = int(
        await db.scalar(
            select(func.count()).select_from(Domain).where(Domain.is_available.is_(True))
        )
        or 0
    )
    return MetaOut(
        app_name=settings.app_name,
        zones=list(ZONES),
        rarities=rarity_payload(),
        roll_types=[RollTypeOut(**item) for item in spin_types_payload()],
        upgrade_sectors=[UpgradeSectorOut(**item) for item in upgrade_sectors_payload()],
        economy={
            "start_balance": settings.start_balance,
            "daily_bonus_percent": settings.daily_bonus_percent,
            "daily_bonus_max": settings.daily_bonus_max,
            "daily_cooldown_hours": settings.daily_cooldown_hours,
            "spin_cooldown_seconds": settings.spin_cooldown_seconds,
            "total_domains": total_domains,
            "upgrade_chance_ranges": {
                "10": [10.0, 10.99],
                "25": [25.0, 25.99],
                "50": [50.0, 50.99],
                "75": [75.0, 75.99],
            },
        },
        total_domains=total_domains,
    )
