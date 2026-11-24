from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserTheme
from app.schemas import ThemeIn, ThemeItemOut, ThemeOut, ThemesOut
from app.security import get_current_user
from app.services.themes import DEFAULT_THEME, THEME_BY_KEY, THEMES

router = APIRouter(tags=["theme"])
HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


async def _owned_keys(db: AsyncSession, user_id: int) -> set[str]:
    keys = {
        str(key)
        for key in (
            await db.scalars(
                select(UserTheme.theme_key).where(UserTheme.user_id == user_id)
            )
        ).all()
    }
    keys.add(DEFAULT_THEME)
    return keys


async def _theme_state(db: AsyncSession, user: User) -> ThemesOut:
    owned = await _owned_keys(db, user.id)
    return ThemesOut(
        themes=[
            ThemeItemOut(
                key=str(theme["key"]),
                title=str(theme["title"]),
                description=str(theme["description"]),
                primary=str(theme["primary"]),
                secondary=str(theme["secondary"]),
                owned=str(theme["key"]) in owned,
                equipped=str(theme["key"]) == (user.theme_key or DEFAULT_THEME),
            )
            for theme in THEMES
        ],
        owned_count=len([theme for theme in THEMES if theme["key"] in owned]),
    )


@router.get("/theme", response_model=ThemeOut)
async def get_theme(user: User = Depends(get_current_user)) -> ThemeOut:
    return ThemeOut(
        theme_key=user.theme_key or DEFAULT_THEME,
        accent_color=user.theme_accent,
    )


@router.put("/theme", response_model=ThemeOut)
async def update_theme(
    payload: ThemeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThemeOut:
    if payload.theme_key not in THEME_BY_KEY:
        raise HTTPException(status_code=422, detail="Неизвестная тема")
    if payload.accent_color is not None and not HEX_COLOR.match(payload.accent_color):
        raise HTTPException(status_code=422, detail="Цвет должен быть в формате #RRGGBB")
    owned = await _owned_keys(db, user.id)
    if payload.theme_key not in owned:
        raise HTTPException(status_code=403, detail="Эта тема ещё не открыта")

    user.theme_key = payload.theme_key
    user.theme_accent = payload.accent_color.upper() if payload.accent_color else None
    await db.commit()
    await db.refresh(user)
    return ThemeOut(theme_key=user.theme_key, accent_color=user.theme_accent)


@router.get("/themes", response_model=ThemesOut)
async def get_themes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThemesOut:
    return await _theme_state(db, user)


@router.post("/themes/{theme_key}/equip", response_model=ThemesOut)
async def equip_theme(
    theme_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThemesOut:
    if theme_key not in THEME_BY_KEY:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    owned = await _owned_keys(db, user.id)
    if theme_key not in owned:
        raise HTTPException(status_code=403, detail="Эта тема ещё не открыта")

    user.theme_key = theme_key
    user.theme_accent = None
    await db.commit()
    await db.refresh(user)
    return await _theme_state(db, user)
