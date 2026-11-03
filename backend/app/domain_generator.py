"""Real-domain catalog with a deliberately smooth price ladder.

Names come from a static snapshot of the Majestic Million ranking. Prices are
game values, not market valuations, and do not imply ownership or transfer
rights. Rarity bands are contiguous, and prices inside each band are spread
evenly so neighbouring domains differ by only a few coins.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.economy import (
    MAX_DOMAIN_COUNT,
    POPULAR_PRICES,
    PREMIUM_PRICES,
    Rarity,
    ZONES,
    rarity_for_price,
    weight_for,
)

DATA_DIR = Path(__file__).resolve().parent / "data"
REAL_DOMAINS_PATH = DATA_DIR / "real_domains.txt"
SEED = 20261026

# Contiguous rarity bands: the last Common price and the first Rare price are
# neighbours, and so on through the whole ladder.
PRICE_RANGES: dict[Rarity, tuple[int, int]] = {
    "common": (40, 99),
    "rare": (100, 999),
    "epic": (1_000, 4_999),
    "legendary": (5_000, 24_999),
    "mythic": (25_000, 10_000_000),
}

# More domains in the expensive tiers keep price gaps small enough for the
# upgrader to find a close target nearly everywhere.
RARITY_COUNTS: dict[Rarity, int] = {
    "common": 5_000,
    "rare": 4_000,
    "epic": 4_000,
    "legendary": 4_000,
    "mythic": 3_000,
}


@dataclass(frozen=True)
class GeneratedDomain:
    name: str
    zone: str
    price: int
    rarity: Rarity
    weight: float
    is_available: bool = True


@lru_cache(maxsize=1)
def load_real_domains() -> tuple[str, ...]:
    if not REAL_DOMAINS_PATH.exists():
        raise RuntimeError(f"Real domain list is missing: {REAL_DOMAINS_PATH}")
    buckets: dict[str, list[str]] = {zone: [] for zone in ZONES}
    with REAL_DOMAINS_PATH.open(encoding="utf-8") as source:
        for line in source:
            name = line.strip().lower()
            if not name:
                continue
            for zone in ZONES:
                if name.endswith(zone):
                    buckets[zone].append(name)
                    break
    if any(len(bucket) < MAX_DOMAIN_COUNT // len(ZONES) for bucket in buckets.values()):
        raise RuntimeError("Real domain list does not cover all zones")

    quota = MAX_DOMAIN_COUNT // len(ZONES)
    names = [name for zone in ZONES for name in buckets[zone][:quota]]
    # Keep the fixed popular names even if they are below the compact quota.
    required = {f"{name}{zone}" for name, zone in POPULAR_PRICES}
    selected = set(names)
    for missing in required - selected:
        for index in range(len(names) - 1, -1, -1):
            if names[index] not in required:
                names[index] = missing
                break
    return tuple(names)


def _split_zone(domain: str) -> tuple[str, str]:
    for zone in ZONES:
        if domain.endswith(zone) and len(domain) > len(zone):
            name = domain[: -len(zone)]
            if "." not in name:
                return name, zone
    raise ValueError(f"unsupported real domain: {domain}")


def _price_at(index: int, count: int, low: int, high: int) -> int:
    if count <= 1:
        return low
    # Geometric ladder: neighbouring prices differ by no more than ~1%
    # (integer coins make the minimum Common step 1 D).
    return int(round(low * (high / low) ** (index / (count - 1))))


@lru_cache(maxsize=1)
def _build_catalog() -> tuple[GeneratedDomain, ...]:
    special_names = {
        f"{name}{zone}"
        for name, zone in {**PREMIUM_PRICES, **POPULAR_PRICES}.keys()
    }
    pool = [
        full_name
        for full_name in load_real_domains()[:MAX_DOMAIN_COUNT]
        if full_name not in special_names
    ]
    random.Random(SEED).shuffle(pool)

    domains: list[GeneratedDomain] = []
    cursor = 0
    for rarity in ("common", "rare", "epic", "legendary", "mythic"):
        count = RARITY_COUNTS[rarity]
        if rarity == "mythic":
            count -= len(special_names)
        low, high = PRICE_RANGES[rarity]
        selected = pool[cursor : cursor + count]
        cursor += count
        for index, full_name in enumerate(selected):
            name, zone = _split_zone(full_name)
            price = _price_at(index, count, low, high)
            domains.append(
                GeneratedDomain(
                    name=name,
                    zone=zone,
                    price=price,
                    rarity=rarity,
                    weight=round(weight_for(price, rarity), 8),
                )
            )

    for full_name in special_names:
        name, zone = _split_zone(full_name)
        price = POPULAR_PRICES.get((name, zone)) or PREMIUM_PRICES.get((name, zone))
        if price is None:
            continue
        domains.append(
            GeneratedDomain(
                name=name,
                zone=zone,
                price=price,
                rarity=rarity_for_price(price),
                weight=round(weight_for(price, "mythic"), 8),
            )
        )

    if cursor != len(pool):
        raise RuntimeError("Real domain catalog allocation is inconsistent")
    if len(domains) != MAX_DOMAIN_COUNT:
        raise RuntimeError(f"Generated {len(domains)} domains, expected {MAX_DOMAIN_COUNT}")
    return tuple(domains)


def generate_domains(target: int = MAX_DOMAIN_COUNT) -> list[GeneratedDomain]:
    target = min(max(target, 1), MAX_DOMAIN_COUNT)
    return list(_build_catalog()[:target])
