from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import AchievementOut, AchievementsOut
from app.security import get_current_user
from app.services.achievements import achievement_payload
from app.services.player_stats import player_stats
from app.services.stats import collection_stats

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=AchievementsOut)
async def get_achievements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AchievementsOut:
    stats = await player_stats(db, user.id)
    collection_count, _value = await collection_stats(db, user.id)
    achievements, total_luck = achievement_payload(
        {
            **stats,
            "spins": user.total_spins,
            "collection": collection_count,
        }
    )
    return AchievementsOut(
        achievements=[AchievementOut(**item) for item in achievements],
        total_luck=total_luck,
    )
