from __future__ import annotations

import pytest

from app.domain_generator import PRICE_RANGES, generate_domains, load_real_domains
from app.economy import (
    MAX_DOMAIN_COUNT,
    POPULAR_PRICES,
    RARITY_ORDER,
    SPIN_TYPES,
    calculate_price,
    daily_bonus_for,
    length_factor,
    rarity_for_price,
    upgrade_target_value,
    weight_for,
)
from app.services.luck import apply_luck, luck_profile


def test_price_formula_and_rarity_thresholds():
    assert calculate_price("ab", ".com", "dictionary", 1.0) == 100 * 5000 * 50
    assert calculate_price("cat", ".com", "dictionary", 1.0) == 100 * 1000 * 50
    assert calculate_price("vector", ".ru", "dictionary", 1.0) == 5 * 30 * 50
    assert calculate_price("qwrt", ".xyz", "garbage", 1.0) == 9
    assert length_factor(2) == 5000
    assert length_factor(7) == 1
    assert rarity_for_price(99) == "common"
    assert rarity_for_price(100) == "rare"
    assert rarity_for_price(999) == "rare"
    assert rarity_for_price(1_000) == "epic"
    assert rarity_for_price(5_000) == "legendary"
    assert rarity_for_price(25_000) == "mythic"
    assert rarity_for_price(100_000) == "mythic"


def test_weight_applies_rarity_luck():
    assert weight_for(10, "common") > weight_for(1_000_000, "mythic")
    assert weight_for(1_000_000, "mythic") == pytest.approx(5.5 / (1_000_000**0.6), rel=1e-9)
    assert weight_for(100, "rare") > weight_for(100, "common")
    assert weight_for(1, "common") == 2.5


def test_daily_bonus_is_25_percent_with_cap():
    assert daily_bonus_for(2_000) == 500
    assert daily_bonus_for(4_000) == 1_000
    assert daily_bonus_for(100_000_000) == 1_000_000
    assert daily_bonus_for(0) == 0


def test_upgrade_target_differs_from_stake_by_chance():
    assert upgrade_target_value(1_000, 10) == 1_100
    assert upgrade_target_value(1_000, 25.5) == 1_255
    assert upgrade_target_value(1_000, 75) == 1_750
    assert upgrade_target_value(0, 50) == 1


def test_real_catalog_uses_new_price_ranges():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    for domain in domains:
        if (domain.name, domain.zone) in POPULAR_PRICES:
            continue
        low, high = PRICE_RANGES[domain.rarity]
        assert low <= domain.price <= high, (
            f"{domain.name}{domain.zone}: {domain.price} outside "
            f"{domain.rarity} {low}..{high}"
        )


def test_all_roulette_costs_and_rarity_pools():
    assert [SPIN_TYPES[key]["cost"] for key in SPIN_TYPES] == [95, 425, 1_900, 9_000]
    assert "mythic" not in SPIN_TYPES
    assert SPIN_TYPES["normal"]["rarities"] == RARITY_ORDER
    assert SPIN_TYPES["epic_plus"]["rarities"] == ("legendary", "mythic")
    for key, roll in SPIN_TYPES.items():
        assert set(roll["rarity_chances"]) == set(roll["rarities"]), key
        assert sum(roll["rarity_chances"].values()) == pytest.approx(100.0), key


def test_real_domain_catalog_has_requested_sizes_and_brands():
    names = load_real_domains()
    assert len(names) == MAX_DOMAIN_COUNT
    assert len(set(names)) == MAX_DOMAIN_COUNT
    assert "google.com" in names
    assert "microsoft.com" in names
    assert all(name.count(".") == 1 for name in names)


def test_price_ladder_has_small_gaps():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    for rarity in ("common", "rare", "epic", "legendary"):
        prices = sorted(domain.price for domain in domains if domain.rarity == rarity)
        gaps = [right - left for left, right in zip(prices, prices[1:])]
        assert max(gaps) <= 3, (rarity, max(gaps))
    for left, right in (
        ("common", "rare"),
        ("rare", "epic"),
        ("epic", "legendary"),
        ("legendary", "mythic"),
    ):
        left_max = max(domain.price for domain in domains if domain.rarity == left)
        right_min = min(domain.price for domain in domains if domain.rarity == right)
        assert right_min - left_max <= 1, (left, right)


def test_level_and_inventory_luck_shift_chances():
    base = luck_profile(0, {"common": 0, "rare": 0, "epic": 0, "legendary": 0, "mythic": 0})
    assert base.level == 1
    assert base.total_luck == 0

    with_inventory = luck_profile(
        25,
        {"common": 4, "rare": 2, "epic": 1, "legendary": 0, "mythic": 0},
    )
    assert with_inventory.level == 2
    assert with_inventory.level_luck == pytest.approx(1.5)
    assert with_inventory.inventory_luck > 0
    assert with_inventory.total_luck > with_inventory.level_luck

    maximum = luck_profile(
        5_000,
        {"common": 10, "rare": 10, "epic": 10, "legendary": 10, "mythic": 10},
    )
    assert maximum.level == 20
    assert maximum.next_level_spins is None
    assert maximum.total_luck == pytest.approx(30.0)

    chances = SPIN_TYPES["normal"]["rarity_chances"]
    boosted = apply_luck(chances, 20)
    assert sum(boosted.values()) == pytest.approx(100)
    assert boosted["common"] < chances["common"]
    assert boosted["rare"] > chances["rare"]


def test_each_roulette_has_healthy_rtp():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    averages = {
        rarity: sum(domain.price for domain in domains if domain.rarity == rarity)
        / sum(1 for domain in domains if domain.rarity == rarity)
        for rarity in RARITY_ORDER
    }
    for key, roll in SPIN_TYPES.items():
        expected = sum(
            roll["rarity_chances"][rarity] / 100 * averages[rarity]
            for rarity in roll["rarities"]
        )
        assert 125 <= expected / roll["cost"] * 100 <= 180, key


def test_full_generator_has_100k_unique_domains_and_examples():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    real_names = set(load_real_domains()[:MAX_DOMAIN_COUNT])
    assert len(domains) == MAX_DOMAIN_COUNT
    assert len({(domain.name, domain.zone) for domain in domains}) == MAX_DOMAIN_COUNT
    assert all(f"{domain.name}{domain.zone}" in real_names for domain in domains)
    assert all(domain.is_available for domain in domains)
    assert {domain.zone for domain in domains} == {".ru", ".com", ".io", ".xyz"}
    counts = {rarity: 0 for rarity in RARITY_ORDER}
    for domain in domains:
        counts[domain.rarity] += 1
        assert rarity_for_price(domain.price) == domain.rarity
    assert all(count > 0 for count in counts.values())

    common = [domain for domain in domains if domain.rarity == "common"]
    assert sum(domain.price for domain in common) / len(common) > 35
    assert sum(1 for domain in common if domain.price > 80) / len(common) > 0.1
    for (name, zone), price in POPULAR_PRICES.items():
        found = next(
            (domain for domain in domains if domain.name == name and domain.zone == zone),
            None,
        )
        assert found is not None, f"{name}{zone} is missing"
        assert found.price == price
        assert found.rarity == "mythic"

    top = max(domains, key=lambda domain: domain.price)
    assert f"{top.name}{top.zone}" == "cars.com"
    assert top.price == 100_000_000
    google = next(
        domain for domain in domains if domain.name == "google" and domain.zone == ".com"
    )
    assert google.price == 10_000_000
