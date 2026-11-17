from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserFrame
from app.schemas import FrameOut, FramesOut
from app.security import get_current_user
from app.services.achievements import achievement_payload
from app.services.frames import FRAME_BY_KEY, FRAMES
from app.services.player_stats import player_stats
from app.services.stats import collection_stats

router = APIRouter(prefix="/frames", tags=["frames"])


async def _frame_state(db: AsyncSession, user: User) -> FramesOut:
    stats = await player_stats(db, user.id)
    collection_count, _value = await collection_stats(db, user.id)
    achievements, _luck = achievement_payload(
        {
            **stats,
            "spins": user.total_spins,
            "collection": collection_count,
        }
    )
    unlocked_achievements = {
        item["key"] for item in achievements if item["unlocked"]
    }
    purchased = set(
        (
            await db.scalars(
                select(UserFrame.frame_key).where(UserFrame.user_id == user.id)
            )
        ).all()
    )
    frames: list[FrameOut] = []
    for frame in FRAMES:
        key = str(frame["key"])
        earned = bool(frame["achievement"] and frame["achievement"] in unlocked_achievements)
        owned = key == "default" or key in purchased or earned
        frames.append(
            FrameOut(
                key=key,
                title=str(frame["title"]),
                description=str(frame["description"]),
                price=frame["price"],
                achievement=frame["achievement"],
                primary=str(frame["primary"]),
                secondary=str(frame["secondary"]),
                owned=owned,
                equipped=key == (user.frame_key or "default"),
            )
        )
    return FramesOut(
        frames=frames,
        equipped=user.frame_key or "default",
        balance=int(user.balance),
    )


async def _locked_user(db: AsyncSession, user_id: int) -> User:
    locked = await db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return locked


@router.get("", response_model=FramesOut)
async def get_frames(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FramesOut:
    return await _frame_state(db, user)


@router.post("/{frame_key}/buy", response_model=FramesOut)
async def buy_frame(
    frame_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FramesOut:
    frame = FRAME_BY_KEY.get(frame_key)
    if frame is None:
        raise HTTPException(status_code=404, detail="Рамка не найдена")
    if frame["achievement"] is not None:
        raise HTTPException(status_code=409, detail="Эта рамка выдаётся за достижение")
    price = int(frame["price"] or 0)

    locked = await _locked_user(db, user.id)
    existing = await db.scalar(
        select(UserFrame).where(
            UserFrame.user_id == locked.id,
            UserFrame.frame_key == frame_key,
        )
    )
    if existing is not None or frame_key == "default":
        raise HTTPException(status_code=409, detail="Рамка уже куплена")
    if locked.balance < price:
        raise HTTPException(status_code=402, detail="Недостаточно монет")

    locked.balance -= price
    db.add(UserFrame(user_id=locked.id, frame_key=frame_key))
    await db.commit()
    await db.refresh(locked)
    return await _frame_state(db, locked)


@router.post("/{frame_key}/equip", response_model=FramesOut)
async def equip_frame(
    frame_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FramesOut:
    frame = FRAME_BY_KEY.get(frame_key)
    if frame is None:
        raise HTTPException(status_code=404, detail="Рамка не найдена")

    locked = await _locked_user(db, user.id)
    owned = await db.scalar(
        select(UserFrame).where(
            UserFrame.user_id == locked.id,
            UserFrame.frame_key == frame_key,
        )
    )
    if frame_key != "default" and owned is None:
        if frame["achievement"] is None:
            raise HTTPException(status_code=403, detail="Сначала купите рамку")
        state = await _frame_state(db, locked)
        if not any(item.key == frame_key and item.owned for item in state.frames):
            raise HTTPException(status_code=403, detail="Достижение ещё не открыто")

    locked.frame_key = frame_key
    await db.commit()
    await db.refresh(locked)
    return await _frame_state(db, locked)
