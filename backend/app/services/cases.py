from __future__ import annotations

import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Domain, UserFrame, UserTheme
from app.services.frames import FRAME_BY_KEY
from app.services.roulette import random_domain_in_rarity
from app.services.themes import THEME_BY_KEY

CASES: tuple[dict, ...] = (
    {
        "key": "starter",
        "title": "Стартовый кейс",
        "description": "Первый шаг: домен, косметика или бустер.",
        "cost": 1,
        "rarities": ("common", "rare"),
        "frames": ("ocean", "sunset"),
        "themes": ("ocean", "sunset"),
        "boost": {"min_percent": 3, "max_percent": 7, "min_spins": 4, "max_spins": 8},
        "accent": "#4D9BFF",
    },
    {
        "key": "premium",
        "title": "Премиум-кейс",
        "description": "Более редкие домены и усиленные бустеры.",
        "cost": 3,
        "rarities": ("rare", "epic"),
        "frames": ("neon", "gold"),
        "themes": ("violet", "emerald"),
        "boost": {"min_percent": 6, "max_percent": 12, "min_spins": 6, "max_spins": 12},
        "accent": "#B07CFF",
    },
    {
        "key": "mythic",
        "title": "Мифический кейс",
        "description": "Шанс на Mythic и эксклюзивную косметику.",
        "cost": 6,
        "rarities": ("legendary", "mythic"),
        "frames": ("mythic",),
        "themes": ("midnight",),
        "boost": {"min_percent": 10, "max_percent": 20, "min_spins": 8, "max_spins": 15},
        "accent": "#F06473",
    },
)

CASES_BY_KEY = {case["key"]: case for case in CASES}


COSMETIC_CHANCE = 0.025
REWARD_WEIGHTS = (
    ("domain", 50.0),
    ("booster", 50.0),
)


async def _domain_offer(db: AsyncSession, case: dict) -> dict:
    rarity = random.choice(list(case["rarities"]))
    domain: Domain | None = None
    for _ in range(12):
        domain = await random_domain_in_rarity(db, rarity)
        if domain is not None:
            break
    if domain is None:
        raise RuntimeError("Пул доменов пуст")
    return {
        "kind": "domain",
        "title": domain.full_name,
        "description": f"{domain.rarity} · {int(domain.price):,} D".replace(",", " "),
        "domain_id": int(domain.id),
        "price": int(domain.price),
        "rarity": domain.rarity,
    }


def _frame_offer(frame_key: str) -> dict:
    frame = FRAME_BY_KEY[frame_key]
    return {
        "kind": "cosmetic",
        "cosmetic_kind": "frame",
        "title": frame["title"],
        "description": "Рамка профиля",
        "frame_key": frame_key,
        "primary": frame["primary"],
    }


def _theme_offer(theme_key: str) -> dict:
    theme = THEME_BY_KEY[theme_key]
    return {
        "kind": "cosmetic",
        "cosmetic_kind": "theme",
        "title": theme["title"],
        "description": "Тема приложения",
        "theme_key": theme_key,
        "primary": theme["primary"],
    }


def _booster_offer(case: dict) -> dict:
    boost = case["boost"]
    percent = random.randint(int(boost["min_percent"]), int(boost["max_percent"]))
    spins = random.randint(int(boost["min_spins"]), int(boost["max_spins"]))
    return {
        "kind": "booster",
        "title": f"Удача +{percent}%",
        "description": f"На {spins} следующих круток",
        "luck_percent": float(percent),
        "spins": int(spins),
    }


async def build_case_offers(db: AsyncSession, case: dict, user_id: int) -> list[dict]:
    """A case has a 2.5% chance to contain one cosmetic; the other slots are
    split evenly between domains and boosters. Already owned cosmetics are
    excluded from the pool."""
    owned_frames = set(
        (
            await db.scalars(
                select(UserFrame.frame_key).where(UserFrame.user_id == user_id)
            )
        ).all()
    )
    owned_themes = set(
        (
            await db.scalars(
                select(UserTheme.theme_key).where(UserTheme.user_id == user_id)
            )
        ).all()
    )
    available_cosmetics: list[tuple[str, str]] = [
        ("frame", str(key))
        for key in case["frames"]
        if str(key) not in owned_frames
    ]
    available_cosmetics.extend(
        ("theme", str(key))
        for key in case["themes"]
        if str(key) not in owned_themes
    )

    kinds = [kind for kind, _weight in REWARD_WEIGHTS]
    weights = [weight for _kind, weight in REWARD_WEIGHTS]
    slot_kinds = [random.choices(kinds, weights=weights, k=1)[0] for _ in range(3)]
    if available_cosmetics and random.random() < COSMETIC_CHANCE:
        slot_kinds[random.randrange(3)] = "cosmetic"

    offers: list[dict] = []
    seen_domain_ids: set[int] = set()
    for kind in slot_kinds:
        if kind == "domain":
            offer = await _domain_offer(db, case)
            attempts = 0
            while int(offer["domain_id"]) in seen_domain_ids and attempts < 5:
                offer = await _domain_offer(db, case)
                attempts += 1
            seen_domain_ids.add(int(offer["domain_id"]))
        elif kind == "cosmetic" and available_cosmetics:
            cosmetic_kind, cosmetic_key = random.choice(available_cosmetics)
            offer = (
                _frame_offer(cosmetic_key)
                if cosmetic_kind == "frame"
                else _theme_offer(cosmetic_key)
            )
            available_cosmetics.remove((cosmetic_kind, cosmetic_key))
        else:
            offer = _booster_offer(case)
        offers.append(offer)

    return offers
