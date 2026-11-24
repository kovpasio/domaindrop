from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import ThemeIn, ThemeOut
from app.security import get_current_user
from app.services.themes import THEME_KEYS

router = APIRouter(prefix="/theme", tags=["theme"])
HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


@router.get("", response_model=ThemeOut)
async def get_theme(user: User = Depends(get_current_user)) -> ThemeOut:
    return ThemeOut(
        theme_key=user.theme_key or "midnight",
        accent_color=user.theme_accent,
    )


@router.put("", response_model=ThemeOut)
async def update_theme(
    payload: ThemeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThemeOut:
    if payload.theme_key not in THEME_KEYS:
        raise HTTPException(status_code=422, detail="Неизвестная тема")
    if payload.accent_color is not None and not HEX_COLOR.match(payload.accent_color):
        raise HTTPException(status_code=422, detail="Цвет должен быть в формате #RRGGBB")
    if payload.theme_key == "custom" and payload.accent_color is None:
        raise HTTPException(status_code=422, detail="Для своей темы выберите цвет")

    user.theme_key = payload.theme_key
    user.theme_accent = payload.accent_color.upper() if payload.accent_color else None
    await db.commit()
    await db.refresh(user)
    return ThemeOut(theme_key=user.theme_key, accent_color=user.theme_accent)
