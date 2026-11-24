from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DailyTaskClaim, Inventory, Spin, Upgrade


TASKS: tuple[dict, ...] = (
    {
        "key": "spins_50",
        "title": "50 круток",
        "description": "Сделайте 50 круток за сегодня",
        "target": 50,
        "reward": 5_000,
        "keys": 2,
        "metric": "spins",
    },
    {
        "key": "sales_10",
        "title": "10 продаж",
        "description": "Продайте 10 доменов за сегодня",
        "target": 10,
        "reward": 8_000,
        "keys": 2,
        "metric": "sales",
    },
    {
        "key": "upgrades_5",
        "title": "5 апгрейдов",
        "description": "Проведите 5 апгрейдов за сегодня",
        "target": 5,
        "reward": 10_000,
        "keys": 3,
        "metric": "upgrades",
    },
)

TASKS_BY_KEY = {task["key"]: task for task in TASKS}


MOSCOW_TZ = timezone(timedelta(hours=3), "MSK")


def game_day(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(MOSCOW_TZ).date()


def day_bounds(day: date) -> tuple[datetime, datetime]:
    start_local = datetime.combine(day, time.min, tzinfo=MOSCOW_TZ)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def next_reset(day: date) -> datetime:
    """Next 00:00 Moscow time, expressed in UTC."""
    end_local = datetime.combine(day, time.min, tzinfo=MOSCOW_TZ) + timedelta(days=1)
    return end_local.astimezone(timezone.utc)


async def daily_metrics(db: AsyncSession, user_id: int, day: date) -> dict[str, int]:
    start, end = day_bounds(day)
    spins = int(
        await db.scalar(
            select(func.count())
            .select_from(Spin)
            .where(Spin.user_id == user_id, Spin.created_at >= start, Spin.created_at < end)
        )
        or 0
    )
    sales = int(
        await db.scalar(
            select(func.count())
            .select_from(Inventory)
            .where(
                Inventory.user_id == user_id,
                Inventory.sold_at.is_not(None),
                Inventory.sold_at >= start,
                Inventory.sold_at < end,
                Inventory.sold_price.is_not(None),
                Inventory.sold_price > 0,
            )
        )
        or 0
    )
    upgrades = int(
        await db.scalar(
            select(func.count())
            .select_from(Upgrade)
            .where(
                Upgrade.user_id == user_id,
                Upgrade.created_at >= start,
                Upgrade.created_at < end,
            )
        )
        or 0
    )
    return {"spins": spins, "sales": sales, "upgrades": upgrades}


async def claimed_task_keys(db: AsyncSession, user_id: int, day: date) -> set[str]:
    rows = (
        await db.scalars(
            select(DailyTaskClaim.task_key).where(
                DailyTaskClaim.user_id == user_id,
                DailyTaskClaim.day == day,
            )
        )
    ).all()
    return {str(key) for key in rows}


def task_payload(metrics: dict[str, int], claimed: set[str]) -> list[dict]:
    tasks: list[dict] = []
    for task in TASKS:
        progress = min(int(task["target"]), metrics.get(task["metric"], 0))
        is_claimed = task["key"] in claimed
        tasks.append(
            {
                "key": task["key"],
                "title": task["title"],
                "description": task["description"],
                "target": int(task["target"]),
                "progress": progress,
                "reward": int(task["reward"]),
                "keys": int(task.get("keys", 0)),
                "claimed": is_claimed,
                "can_claim": progress >= int(task["target"]) and not is_claimed,
            }
        )
    return tasks
