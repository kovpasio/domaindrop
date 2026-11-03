from __future__ import annotations

import random
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.economy import rarity_for_price, upgrade_target_value
from app.models import Domain, Inventory, Upgrade, User
from app.schemas import (
    DomainOut,
    UpgradeIn,
    UpgradeOut,
    UpgradePreviewIn,
    UpgradePreviewOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/upgrade", tags=["upgrade"])
rng = random.SystemRandom()



@router.post("/preview", response_model=UpgradePreviewOut)
async def preview_upgrade(
    payload: UpgradePreviewIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpgradePreviewOut:
    ids = sorted(set(payload.domain_ids))
    if not ids:
        raise HTTPException(status_code=422, detail="Выберите хотя бы один домен")
    items = (
        await db.scalars(
            select(Inventory).where(
                Inventory.user_id == user.id,
                Inventory.id.in_(ids),
                Inventory.sold_at.is_(None),
            )
        )
    ).all()
    if len(items) != len(ids):
        raise HTTPException(status_code=409, detail="Домены недоступны")

    spent = sum(int(item.domain.price) for item in items)
    sector = payload.chance_sector
    exact_chance = payload.chance if payload.chance is not None else sector + 0.5
    if not sector <= exact_chance <= sector + 0.99:
        raise HTTPException(status_code=422, detail="Шанс вне выбранного сектора")
    # Target = stake * 100 / exact chance.
    theoretical_value = upgrade_target_value(spent, exact_chance)
    target_rarity = rarity_for_price(theoretical_value)
    domain = await db.scalar(
        select(Domain)
        .where(Domain.is_available.is_(True), Domain.rarity == target_rarity)
        .order_by(func.abs(Domain.price - theoretical_value))
        .limit(1)
    )
    if domain is None:
        target_rarity = "mythic"
        domain = await db.scalar(
            select(Domain)
            .where(Domain.is_available.is_(True), Domain.rarity == "mythic")
            .order_by(func.abs(Domain.price - theoretical_value))
            .limit(1)
        )
    return UpgradePreviewOut(
        # The preview and the real drop use one and the same price: no gap
        # between "Цель" and "Может выпасть".
        target_value=int(domain.price) if domain else theoretical_value,
        target_rarity=domain.rarity if domain else target_rarity,
        domain=DomainOut.model_validate(domain) if domain else None,
    )


@router.post("", response_model=UpgradeOut)
async def upgrade_domains(
    payload: UpgradeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpgradeOut:
    ids = sorted(set(payload.domain_ids))
    if not ids:
        raise HTTPException(status_code=422, detail="Выберите хотя бы один домен")

    locked_user = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    items = (
        await db.scalars(
            select(Inventory)
            .where(
                Inventory.user_id == user.id,
                Inventory.id.in_(ids),
                Inventory.sold_at.is_(None),
            )
            .order_by(Inventory.id)
            .with_for_update(of=Inventory)
            .execution_options(populate_existing=True)
        )
    ).all()
    if len(items) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Некоторые домены уже проданы или не принадлежат вам",
        )

    spent_value = sum(int(item.domain.price) for item in items)
    sector = payload.chance_sector
    exact_chance = payload.chance
    if exact_chance is None:
        exact_chance = sector + rng.random() * 0.99
    if not sector <= exact_chance <= sector + 0.99:
        raise HTTPException(status_code=422, detail="Шанс вне выбранного сектора")
    exact_chance = round(exact_chance, 2)
    multiplier = 100 / exact_chance
    success = rng.random() * 100 < exact_chance
    now = datetime.now(timezone.utc)

    # All selected domains are consumed in both outcomes.
    for item in items:
        item.sold_at = now
        item.sold_price = 0

    theoretical_value = upgrade_target_value(spent_value, exact_chance)
    target_rarity = rarity_for_price(theoretical_value)
    target_value = theoretical_value
    won_domain: Domain | None = None

    if success:
        won_domain = await db.scalar(
            select(Domain)
            .where(
                Domain.is_available.is_(True),
                Domain.rarity == target_rarity,
            )
            .order_by(func.abs(Domain.price - theoretical_value))
            .limit(1)
        )
        if won_domain is None:
            target_rarity = "mythic"
            won_domain = await db.scalar(
                select(Domain)
                .where(Domain.is_available.is_(True), Domain.rarity == "mythic")
                .order_by(func.abs(Domain.price - theoretical_value))
                .limit(1)
            )
        if won_domain is None:
            raise HTTPException(status_code=503, detail="Подходящих реальных доменов нет")

        # Report the actual chosen price as the target, so preview/result and
        # the real reward never show a gap.
        target_value = int(won_domain.price)
        target_rarity = won_domain.rarity

        db.add(
            Inventory(
                user_id=locked_user.id,
                domain_id=won_domain.id,
                acquired_at=now,
            )
        )

    upgrade = Upgrade(
        user_id=locked_user.id,
        from_domain_ids=ids,
        to_domain_id=won_domain.id if won_domain else None,
        chance=Decimal(str(exact_chance)),
        multiplier=Decimal(str(multiplier)),
        success=success,
        created_at=now,
    )
    db.add(upgrade)
    await db.commit()
    await db.refresh(upgrade)

    return UpgradeOut(
        id=upgrade.id,
        success=success,
        chance=exact_chance,
        multiplier=multiplier,
        spent_value=spent_value,
        target_value=target_value,
        from_domain_ids=ids,
        burned_ids=ids,
        domain=DomainOut.model_validate(won_domain) if won_domain else None,
        balance=locked_user.balance,
        created_at=upgrade.created_at,
    )
