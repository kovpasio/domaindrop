from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    CaseOpening,
    Domain,
    Inventory,
    User,
    UserBooster,
    UserFrame,
    UserTheme,
)
from app.schemas import (
    CaseChooseIn,
    CaseChooseOut,
    CaseInfoOut,
    CaseOpenOut,
    CaseOfferOut,
    CasesOut,
)
from app.security import get_current_user
from app.services.cases import CASES, CASES_BY_KEY, build_case_offers
from app.services.frames import FRAME_BY_KEY
from app.services.themes import THEME_BY_KEY

router = APIRouter(prefix="/cases", tags=["cases"])


def _open_payload(opening: CaseOpening, keys: int) -> CaseOpenOut:
    case = CASES_BY_KEY.get(opening.case_key)
    title = str(case["title"]) if case else "Кейс"
    return CaseOpenOut(
        opening_id=int(opening.id),
        case_key=opening.case_key,
        title=title,
        keys=keys,
        offers=[CaseOfferOut(**offer) for offer in opening.offers],
    )


async def _locked_user(db: AsyncSession, user_id: int) -> User:
    user = await db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


@router.get("", response_model=CasesOut)
async def get_cases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CasesOut:
    pending = await db.scalar(
        select(CaseOpening)
        .where(CaseOpening.user_id == user.id, CaseOpening.claimed.is_(False))
        .order_by(CaseOpening.id.desc())
        .limit(1)
    )
    return CasesOut(
        cases=[
            CaseInfoOut(
                key=str(case["key"]),
                title=str(case["title"]),
                description=str(case["description"]),
                cost=int(case["cost"]),
                accent=str(case["accent"]),
                rarities=list(case["rarities"]),
            )
            for case in CASES
        ],
        keys=int(user.case_keys),
        pending=_open_payload(pending, int(user.case_keys)) if pending else None,
    )


@router.post("/{case_key}/open", response_model=CaseOpenOut)
async def open_case(
    case_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CaseOpenOut:
    case = CASES_BY_KEY.get(case_key)
    if case is None:
        raise HTTPException(status_code=404, detail="Кейс не найден")

    locked = await _locked_user(db, user.id)
    pending = await db.scalar(
        select(CaseOpening.id).where(
            CaseOpening.user_id == locked.id,
            CaseOpening.claimed.is_(False),
        )
    )
    if pending is not None:
        raise HTTPException(status_code=409, detail="Сначала выберите награду из прошлого кейса")
    if locked.case_keys < int(case["cost"]):
        raise HTTPException(status_code=402, detail="Недостаточно ключей")

    try:
        offers = await build_case_offers(db, case, locked.id)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    locked.case_keys -= int(case["cost"])
    opening = CaseOpening(
        user_id=locked.id,
        case_key=case_key,
        offers=offers,
    )
    db.add(opening)
    await db.commit()
    await db.refresh(opening)
    await db.refresh(locked)
    return _open_payload(opening, int(locked.case_keys))


@router.post("/openings/{opening_id}/choose", response_model=CaseChooseOut)
async def choose_case_reward(
    opening_id: int,
    payload: CaseChooseIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CaseChooseOut:
    locked = await _locked_user(db, user.id)
    opening = await db.scalar(
        select(CaseOpening)
        .where(CaseOpening.id == opening_id, CaseOpening.user_id == locked.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if opening is None:
        raise HTTPException(status_code=404, detail="Кейс не найден")
    if opening.claimed:
        raise HTTPException(status_code=409, detail="Награда уже выбрана")
    if payload.offer_index >= len(opening.offers):
        raise HTTPException(status_code=422, detail="Неверная награда")

    offer = opening.offers[payload.offer_index]
    kind = str(offer["kind"])
    message = ""
    if kind == "domain":
        domain = await db.get(Domain, int(offer["domain_id"]))
        if domain is None:
            raise HTTPException(status_code=409, detail="Домен больше недоступен")
        db.add(Inventory(user_id=locked.id, domain_id=domain.id))
        message = f"{domain.full_name} добавлен в инвентарь"
    elif kind == "cosmetic":
        cosmetic_kind = str(offer.get("cosmetic_kind") or "frame")
        if cosmetic_kind == "theme":
            theme_key = str(offer["theme_key"])
            existing = await db.scalar(
                select(UserTheme).where(
                    UserTheme.user_id == locked.id,
                    UserTheme.theme_key == theme_key,
                )
            )
            if existing is not None:
                locked.case_keys += 2
                message = "Тема уже была — начислено 2 ключа"
            else:
                db.add(UserTheme(user_id=locked.id, theme_key=theme_key))
                theme = THEME_BY_KEY[theme_key]
                message = f"Тема «{theme['title']}» добавлена"
        else:
            frame_key = str(offer["frame_key"])
            existing = await db.scalar(
                select(UserFrame).where(
                    UserFrame.user_id == locked.id,
                    UserFrame.frame_key == frame_key,
                )
            )
            if existing is not None:
                locked.case_keys += 2
                message = "Рамка уже была — начислено 2 ключа"
            else:
                db.add(UserFrame(user_id=locked.id, frame_key=frame_key))
                message = f"Рамка «{FRAME_BY_KEY[frame_key]['title']}» добавлена"
    elif kind == "booster":
        percent = float(offer["luck_percent"])
        spins = int(offer["spins"])
        db.add(
            UserBooster(
                user_id=locked.id,
                kind="luck",
                percent=percent,
                spins=spins,
            )
        )
        message = f"Бустер +{percent:g}% на {spins} круток добавлен в инвентарь"
    else:
        raise HTTPException(status_code=422, detail="Неизвестная награда")

    opening.claimed = True
    await db.commit()
    await db.refresh(locked)
    return CaseChooseOut(
        kind=kind,
        title=str(offer["title"]),
        description=str(offer["description"]),
        keys=int(locked.case_keys),
        balance=int(locked.balance),
        message=message,
    )
