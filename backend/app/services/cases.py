from __future__ import annotations

import random

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Domain
from app.services.frames import FRAME_BY_KEY
from app.services.roulette import random_domain_in_rarity

CASES: tuple[dict, ...] = (
    {
        "key": "starter",
        "title": "Стартовый кейс",
        "description": "Первый шаг: домен, косметика или бустер.",
        "cost": 1,
        "rarities": ("common", "rare"),
        "frames": ("ocean", "sunset", "frame_spins_1000"),
        "boost": {"percent": 5.0, "spins": 5},
        "accent": "#4D9BFF",
    },
    {
        "key": "premium",
        "title": "Премиум-кейс",
        "description": "Более редкие домены и усиленные бустеры.",
        "cost": 3,
        "rarities": ("rare", "epic"),
        "frames": ("neon", "gold", "frame_collector_50"),
        "boost": {"percent": 10.0, "spins": 10},
        "accent": "#B07CFF",
    },
    {
        "key": "mythic",
        "title": "Мифический кейс",
        "description": "Шанс на Mythic и эксклюзивную косметику.",
        "cost": 6,
        "rarities": ("legendary", "mythic"),
        "frames": ("mythic", "frame_first_mythic"),
        "boost": {"percent": 15.0, "spins": 15},
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


def _cosmetic_offer(case: dict) -> dict:
    frame_key = random.choice(list(case["frames"]))
    frame = FRAME_BY_KEY[frame_key]
    return {
        "kind": "cosmetic",
        "title": frame["title"],
        "description": "Рамка профиля",
        "frame_key": frame_key,
        "primary": frame["primary"],
    }


def _booster_offer(case: dict) -> dict:
    boost = case["boost"]
    return {
        "kind": "booster",
        "title": f"Удача +{boost['percent']:g}%",
        "description": f"На {boost['spins']} следующих круток",
        "luck_percent": float(boost["percent"]),
        "spins": int(boost["spins"]),
    }


async def build_case_offers(db: AsyncSession, case: dict) -> list[dict]:
    """A case has a 2.5% chance to contain one cosmetic; the other slots are
    split evenly between domains and boosters."""
    kinds = [kind for kind, _weight in REWARD_WEIGHTS]
    weights = [weight for _kind, weight in REWARD_WEIGHTS]

    slot_kinds = [random.choices(kinds, weights=weights, k=1)[0] for _ in range(3)]
    if random.random() < COSMETIC_CHANCE:
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
        elif kind == "cosmetic":
            offer = _cosmetic_offer(case)
        else:
            offer = _booster_offer(case)
        offers.append(offer)

    return offers
