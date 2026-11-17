from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.economy import SPIN_TYPES
from app.models import Inventory, Spin, Upgrade


async def player_stats(db: AsyncSession, user_id: int) -> dict[str, int]:
    roll_rows = (
        await db.execute(
            select(Spin.roll_type, func.count())
            .where(Spin.user_id == user_id)
            .group_by(Spin.roll_type)
        )
    ).all()
    total_spent = sum(
        int(SPIN_TYPES.get(str(roll_type), {}).get("cost", 0)) * int(count)
        for roll_type, count in roll_rows
    )

    sold = int(
        await db.scalar(
            select(func.coalesce(func.sum(Inventory.sold_price), 0)).where(
                Inventory.user_id == user_id,
                Inventory.sold_at.is_not(None),
                Inventory.sold_price.is_not(None),
                Inventory.sold_price > 0,
            )
        )
        or 0
    )
    auto_sold = int(
        await db.scalar(
            select(func.coalesce(func.sum(Spin.auto_sold_price), 0)).where(
                Spin.user_id == user_id,
                Spin.auto_sold.is_(True),
                Spin.auto_sold_price.is_not(None),
            )
        )
        or 0
    )
    sales_count = int(
        await db.scalar(
            select(func.count())
            .select_from(Inventory)
            .where(
                Inventory.user_id == user_id,
                Inventory.sold_at.is_not(None),
                Inventory.sold_price.is_not(None),
                Inventory.sold_price > 0,
            )
        )
        or 0
    )
    best_drop = int(
        await db.scalar(select(func.coalesce(func.max(Spin.price), 0)).where(Spin.user_id == user_id))
        or 0
    )
    biggest_sale = max(
        int(
            await db.scalar(
                select(func.coalesce(func.max(Inventory.sold_price), 0)).where(
                    Inventory.user_id == user_id,
                    Inventory.sold_at.is_not(None),
                )
            )
            or 0
        ),
        int(
            await db.scalar(
                select(func.coalesce(func.max(Spin.auto_sold_price), 0)).where(
                    Spin.user_id == user_id,
                    Spin.auto_sold.is_(True),
                )
            )
            or 0
        ),
    )
    mythic_drops = int(
        await db.scalar(
            select(func.count())
            .select_from(Spin)
            .where(Spin.user_id == user_id, Spin.rarity == "mythic")
        )
        or 0
    )
    upgrades_total = int(
        await db.scalar(
            select(func.count()).select_from(Upgrade).where(Upgrade.user_id == user_id)
        )
        or 0
    )
    upgrades_success = int(
        await db.scalar(
            select(func.count())
            .select_from(Upgrade)
            .where(Upgrade.user_id == user_id, Upgrade.success.is_(True))
        )
        or 0
    )

    return {
        "total_earned": sold + auto_sold,
        "sales_count": sales_count,
        "total_spent": total_spent,
        "best_drop": best_drop,
        "biggest_sale": biggest_sale,
        "mythic_drops": mythic_drops,
        "upgrades_total": upgrades_total,
        "upgrades_success": upgrades_success,
    }
