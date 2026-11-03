from __future__ import annotations

from dataclasses import dataclass

from app.economy import RARITY_ORDER, Rarity

# Level thresholds are based on the total number of spins.
LEVELS: tuple[tuple[int, str], ...] = (
    (0, "Новичок"),
    (25, "Стажёр"),
    (60, "Пилот"),
    (110, "Ас"),
    (180, "Ветеран"),
    (270, "Мастер"),
    (380, "Эксперт"),
    (520, "Легенда"),
    (700, "Гранд"),
    (900, "Мифический"),
    (1_150, "Небесный"),
    (1_450, "Звёздный"),
    (1_800, "Космический"),
    (2_200, "Галактический"),
    (2_650, "Сверхновая"),
    (3_150, "Квазар"),
    (3_700, "Пульсар"),
    (4_300, "Горизонт"),
    (4_650, "Сингулярность"),
    (5_000, "Абсолют"),
)

LEVEL_LUCK_STEP = 1.25
INVENTORY_LUCK = {
    "common": 0.03,
    "rare": 0.08,
    "epic": 0.20,
    "legendary": 0.50,
    "mythic": 1.00,
}
INVENTORY_LUCK_CAP = 5.0
TOTAL_LUCK_CAP = 30.0


@dataclass(frozen=True)
class LuckProfile:
    level: int
    title: str
    total_spins: int
    next_level_spins: int | None
    spins_into_level: int
    spins_to_next: int | None
    level_luck: float
    inventory_luck: float
    total_luck: float


def level_index(total_spins: int) -> int:
    index = 0
    for candidate, (threshold, _title) in enumerate(LEVELS):
        if total_spins >= threshold:
            index = candidate
    return index


def inventory_luck(counts: dict[str, int]) -> float:
    value = sum(INVENTORY_LUCK.get(rarity, 0.0) * count for rarity, count in counts.items())
    return min(INVENTORY_LUCK_CAP, value)


def luck_profile(total_spins: int, inventory_counts: dict[str, int]) -> LuckProfile:
    index = level_index(total_spins)
    threshold, title = LEVELS[index]
    next_threshold = LEVELS[index + 1][0] if index + 1 < len(LEVELS) else None
    level_luck = index * LEVEL_LUCK_STEP
    inv_luck = inventory_luck(inventory_counts)
    total_luck = min(TOTAL_LUCK_CAP, level_luck + inv_luck)
    return LuckProfile(
        level=index + 1,
        title=title,
        total_spins=total_spins,
        next_level_spins=next_threshold,
        spins_into_level=max(0, total_spins - threshold),
        spins_to_next=(
            max(0, next_threshold - total_spins) if next_threshold is not None else None
        ),
        level_luck=round(level_luck, 2),
        inventory_luck=round(inv_luck, 2),
        total_luck=round(total_luck, 2),
    )


def apply_luck(chances: dict[Rarity, float], total_luck: float) -> dict[Rarity, float]:
    """Shift odds toward the higher tiers without changing the total."""
    if total_luck <= 0:
        return dict(chances)
    lowest = min(chances, key=RARITY_ORDER.index)
    factor = 1 + total_luck / 40.0
    adjusted = {
        rarity: value * (factor if rarity != lowest else 1.0)
        for rarity, value in chances.items()
    }
    total = sum(adjusted.values())
    return {rarity: value / total * 100 for rarity, value in adjusted.items()}
