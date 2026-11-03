from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.config import settings
from app.database import get_db
from app.economy import SPIN_TYPES
from app.models import Domain, Inventory, Spin, User
from app.schemas import DomainOut, KeepSpinOut, SpinBatchOut, SpinIn, SpinOut
from app.security import get_current_user
from app.services.autosell import get_or_create_settings, should_autosell
from app.services.realtime import publish_drop
from app.services.redis_client import redis_client
from app.services.luck import apply_luck, luck_profile
from app.services.roulette import choose_rarity, random_domain_in_rarity
from app.services.stats import collection_breakdown

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/spin", tags=["spin"])


def _cooldown_key(user_id: int) -> str:
    return f"dropzone:spin:cooldown:{user_id}"


async def _enforce_cooldown(user_id: int) -> None:
    try:
        allowed = await redis_client.set(
            _cooldown_key(user_id),
            "1",
            nx=True,
            ex=settings.spin_cooldown_seconds,
        )
        if not allowed:
            ttl = await redis_client.ttl(_cooldown_key(user_id))
            retry_after = max(1, int(ttl))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Слишком быстро. Подождите {retry_after} с.",
                headers={"Retry-After": str(retry_after)},
            )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - infrastructure path
        logger.exception("Redis cooldown failed")
        raise HTTPException(
            status_code=503,
            detail="Сервис временно недоступен (Redis)",
        ) from exc


async def _release_cooldown(user_id: int) -> None:
    try:
        await redis_client.delete(_cooldown_key(user_id))
    except Exception:  # pragma: no cover
        logger.warning("Could not release spin cooldown for %s", user_id)


@router.post("", response_model=SpinOut | SpinBatchOut)
async def spin(
    payload: SpinIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpinOut | SpinBatchOut:
    roll = SPIN_TYPES[payload.roll_type]
    times = payload.times
    total_cost = roll["cost"] * times
    await _enforce_cooldown(user.id)
    now = datetime.now(timezone.utc)

    try:
        locked_user = await db.scalar(
            select(User)
            .where(User.id == user.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if locked_user is None:
            raise HTTPException(status_code=401, detail="Пользователь не найден")

        if locked_user.balance < total_cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Недостаточно монет: нужно {total_cost}",
            )

        inventory_counts = await collection_breakdown(db, locked_user.id)
        progress = luck_profile(locked_user.total_spins, inventory_counts)
        chances = apply_luck(roll["rarity_chances"], progress.total_luck)
        autosell = await get_or_create_settings(db, locked_user.id)

        created: list[tuple[Spin, Domain, Inventory | None, bool, int]] = []
        seen_domains: set[int] = set()
        for _ in range(times):
            rarity = choose_rarity(roll, chances)
            domain = None
            for _attempt in range(20):
                candidate = await random_domain_in_rarity(db, rarity)
                if candidate is None:
                    break
                if candidate.id not in seen_domains or _attempt == 19:
                    domain = candidate
                    break
            if domain is None:
                raise HTTPException(status_code=503, detail="Пул доменов пуст")
            seen_domains.add(domain.id)

            price = int(domain.price)
            sale_price = price
            auto_sold = should_autosell(autosell, domain.rarity, price)
            locked_user.balance -= roll["cost"]
            if auto_sold:
                locked_user.balance += sale_price
            locked_user.total_spins += 1

            server_seed = secrets.token_hex(32)
            spin_row = Spin(
                commitment_id=None,
                user_id=locked_user.id,
                domain_id=domain.id,
                roll_type=payload.roll_type,
                rarity=domain.rarity,
                base_rarity=domain.rarity,
                server_seed=server_seed,
                server_seed_hash=hashlib.sha256(server_seed.encode()).hexdigest(),
                client_seed=secrets.token_hex(8),
                nonce=locked_user.total_spins,
                rarity_roll=0,
                domain_roll=0,
                domain_index=0,
                bucket_size=0,
                pity_applied=False,
                price=price,
                auto_sold=auto_sold,
                auto_sold_price=sale_price if auto_sold else None,
                created_at=now,
            )
            db.add(spin_row)
            await db.flush()

            inventory_row: Inventory | None = None
            if not auto_sold:
                inventory_row = Inventory(
                    user_id=locked_user.id,
                    domain_id=domain.id,
                    acquired_at=now,
                )
                db.add(inventory_row)
                await db.flush()

            created.append((spin_row, domain, inventory_row, auto_sold, sale_price))

        await db.commit()

        items: list[SpinOut] = []
        for spin_row, domain, inventory_row, auto_sold, sale_price in created:
            spin_row.user = locked_user
            spin_row.domain = domain
            await publish_drop(spin_row)
            items.append(
                SpinOut(
                    id=spin_row.id,
                    roll_type=payload.roll_type,
                    times=1,
                    domain=DomainOut.model_validate(domain),
                    rarity=domain.rarity,
                    price=int(domain.price),
                    balance=locked_user.balance,
                    auto_sold=auto_sold,
                    auto_sold_price=sale_price if auto_sold else None,
                    inventory_id=inventory_row.id if inventory_row is not None else None,
                    created_at=spin_row.created_at,
                )
            )

        if times == 1:
            return items[0]
        return SpinBatchOut(
            items=items,
            times=times,
            total_cost=total_cost,
            balance=locked_user.balance,
        )
    except HTTPException:
        await db.rollback()
        await _release_cooldown(user.id)
        raise
    except Exception:
        await db.rollback()
        await _release_cooldown(user.id)
        logger.exception("Spin failed for user %s", user.id)
        raise


@router.post("/{spin_id}/keep", response_model=KeepSpinOut)
async def keep_auto_sold_spin(
    spin_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KeepSpinOut:
    locked_user = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    # Spin has joined relationships (domain/user). Loading them here makes
    # PostgreSQL reject FOR UPDATE because of the nullable outer join, so the
    # keep operation deliberately loads only the spin row.
    spin_row = await db.scalar(
        select(Spin)
        .where(Spin.id == spin_id, Spin.user_id == user.id)
        .options(noload(Spin.domain), noload(Spin.user))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if spin_row is None:
        raise HTTPException(status_code=404, detail="Спин не найден")
    if not spin_row.auto_sold:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Домен уже оставлен или не был продан автоматически",
        )

    price = int(spin_row.auto_sold_price or spin_row.price)
    if locked_user.balance < price:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Монеты уже потрачены — оставить домен нельзя",
        )

    domain = await db.get(Domain, spin_row.domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail="Домен не найден")
    spin_row_id = spin_row.id

    locked_user.balance -= price
    item = Inventory(
        user_id=locked_user.id,
        domain_id=domain.id,
        acquired_at=datetime.now(timezone.utc),
    )
    db.add(item)
    await db.flush()
    item_id = item.id
    spin_row.auto_sold = False
    spin_row.auto_sold_price = None
    await db.commit()
    await db.refresh(locked_user)

    return KeepSpinOut(
        spin_id=spin_row_id,
        domain=DomainOut.model_validate(domain),
        inventory_id=item_id,
        balance=locked_user.balance,
    )
