from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DailyTaskClaim, User
from app.schemas import DailyTaskOut, DailyTasksOut, TaskClaimOut
from app.security import get_current_user
from app.services.tasks import (
    TASKS_BY_KEY,
    claimed_task_keys,
    daily_metrics,
    game_day,
    next_reset,
    task_payload,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _tasks_for_user(db: AsyncSession, user_id: int) -> DailyTasksOut:
    day = game_day()
    metrics = await daily_metrics(db, user_id, day)
    claimed = await claimed_task_keys(db, user_id, day)
    return DailyTasksOut(
        day=day.isoformat(),
        reset_at=next_reset(day),
        tasks=[DailyTaskOut(**task) for task in task_payload(metrics, claimed)],
    )


@router.get("", response_model=DailyTasksOut)
async def get_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyTasksOut:
    return await _tasks_for_user(db, user.id)


@router.post("/{task_key}/claim", response_model=TaskClaimOut)
async def claim_task(
    task_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskClaimOut:
    task = TASKS_BY_KEY.get(task_key)
    if task is None:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    locked = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    day = game_day()
    claimed = await claimed_task_keys(db, locked.id, day)
    if task_key in claimed:
        raise HTTPException(status_code=409, detail="Награда уже получена")

    metrics = await daily_metrics(db, locked.id, day)
    if metrics.get(str(task["metric"]), 0) < int(task["target"]):
        raise HTTPException(status_code=409, detail="Задание ещё не выполнено")

    amount = int(task["reward"])
    key_amount = int(task.get("keys", 0))
    locked.balance += amount
    locked.case_keys += key_amount
    db.add(
        DailyTaskClaim(
            user_id=locked.id,
            task_key=task_key,
            day=day,
            reward=amount,
        )
    )
    await db.commit()
    await db.refresh(locked)
    return TaskClaimOut(
        key=task_key,
        amount=amount,
        balance=locked.balance,
        keys=key_amount,
        case_keys=locked.case_keys,
    )
