from __future__ import annotations

import copy
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

import fakeredis.aioredis
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.economy import weight_for
from app.models import Base, Domain, Inventory, User
from app.services.stats import leaderboard as get_leaderboard
from app.routers import (
    admin,
    auth,
    domains,
    earnings,
    inventory,
    leaderboard,
    settings as settings_router,
    spins,
    upgrades,
    users,
)

TEST_DOMAINS = [
    Domain(
        name="cat",
        zone=".com",
        price=1_100_000,
        rarity="mythic",
        weight=weight_for(1_100_000, "mythic"),
        is_available=True,
    ),
    Domain(
        name="vault",
        zone=".com",
        price=50_000,
        rarity="legendary",
        weight=weight_for(50_000, "legendary"),
        is_available=True,
    ),
    Domain(
        name="vector",
        zone=".ru",
        price=5_000,
        rarity="epic",
        weight=weight_for(5_000, "epic"),
        is_available=True,
    ),
    Domain(
        name="hub",
        zone=".io",
        price=200,
        rarity="rare",
        weight=weight_for(200, "rare"),
        is_available=True,
    ),
    Domain(
        name="cheap",
        zone=".xyz",
        price=10,
        rarity="common",
        weight=weight_for(10, "common"),
        is_available=True,
    ),
]


class FakeRng:
    def random(self) -> float:
        return 0.0

    def uniform(self, _a: float, _b: float) -> float:
        return 1.0

    def choice(self, values):
        return values[0]


@pytest.fixture
async def test_context(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with Session() as session:
        session.add_all(copy.deepcopy(TEST_DOMAINS))
        await session.commit()

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        async with Session() as session:
            yield session

    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(spins, "redis_client", fake)
    import app.services.realtime as realtime

    monkeypatch.setattr(realtime, "redis_client", fake)

    app = FastAPI()
    for router in (
        auth.router,
        admin.router,
        users.router,
        domains.router,
        spins.router,
        earnings.router,
        inventory.router,
        leaderboard.router,
        settings_router.router,
        upgrades.router,
    ):
        app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, Session, fake

    await fake.aclose()
    await engine.dispose()


async def _auth(
    client: AsyncClient,
    user_id: int = 900001,
    username: str = "tester",
) -> tuple[dict, dict]:
    response = await client.post(
        "/api/auth/telegram",
        json={"dev_user": {"id": user_id, "username": username, "first_name": "Test"}},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return payload, {"Authorization": f"Bearer {payload['access_token']}"}


async def _clear_cooldown(fake, user_id: int) -> None:
    await fake.delete(f"dropzone:spin:cooldown:{user_id}")


async def test_full_game_flow(test_context, monkeypatch):
    client, _Session, fake = test_context
    payload, headers = await _auth(client)
    user_id = payload["user"]["id"]

    me = await client.get("/api/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user"]["balance"] == 2000
    assert me.json()["user"]["created_at"].endswith(("+00:00", "Z"))
    assert me.json()["progress"]["level"] == 1
    assert me.json()["progress"]["total_luck"] == 0

    meta = await client.get("/api/meta")
    assert meta.status_code == 200
    meta_data = meta.json()
    assert meta_data["total_domains"] == 5
    assert [item["cost"] for item in meta_data["roll_types"]] == [100, 700, 3_500, 15_000]
    assert [item["key"] for item in meta_data["roll_types"]] == [
        "normal",
        "uncommon_plus",
        "rare_plus",
        "epic_plus",
    ]

    feed = await client.get("/api/domains/feed?roll_type=normal", headers=headers)
    assert feed.status_code == 200
    assert len(feed.json()) == 5

    settings = await client.get("/api/settings/autosell", headers=headers)
    assert settings.status_code == 200
    assert settings.json()["autosell_common"] is False

    # Rate limit after the first successful spin.
    first = await client.post("/api/spin", headers=headers, json={"roll_type": "normal"})
    assert first.status_code == 200, first.text
    first_data = first.json()
    assert first_data["balance"] == 1900
    assert first_data["auto_sold"] is False
    assert first_data["inventory_id"] is not None
    assert "server_seed" not in first_data
    limited = await client.post("/api/spin", headers=headers, json={"roll_type": "normal"})
    assert limited.status_code == 429

    # Autosell everything.
    response = await client.put(
        "/api/settings/autosell",
        headers=headers,
        json={
            "autosell_common": True,
            "autosell_rare": True,
            "autosell_epic": True,
            "autosell_legendary": True,
            "autosell_mythic": True,
            "autosell_below_price": None,
        },
    )
    assert response.status_code == 200
    await _clear_cooldown(fake, user_id)
    auto_spin = await client.post("/api/spin", headers=headers, json={"roll_type": "normal"})
    assert auto_spin.status_code == 200, auto_spin.text
    auto_data = auto_spin.json()
    assert auto_data["auto_sold"] is True
    assert auto_data["auto_sold_price"] == auto_data["price"]
    assert auto_data["balance"] == 1900 - 100 + auto_data["auto_sold_price"]

    # Turn autosell off and collect three domains.
    response = await client.put(
        "/api/settings/autosell",
        headers=headers,
        json={
            "autosell_common": False,
            "autosell_rare": False,
            "autosell_epic": False,
            "autosell_legendary": False,
            "autosell_mythic": False,
            "autosell_below_price": None,
        },
    )
    assert response.status_code == 200
    for _ in range(3):
        await _clear_cooldown(fake, user_id)
        spin = await client.post("/api/spin", headers=headers, json={"roll_type": "normal"})
        assert spin.status_code == 200, spin.text

    inventory = await client.get("/api/inventory", headers=headers)
    assert inventory.status_code == 200
    items = inventory.json()
    assert len(items) == 4
    ids = [item["id"] for item in items]

    sold = await client.post(
        "/api/inventory/sell-bulk",
        headers=headers,
        json={"ids": ids[:2]},
    )
    assert sold.status_code == 200, sold.text
    sold_data = sold.json()
    assert sold_data["sold"] == 2
    selected_prices = {
        item["id"]: item["domain"]["price"] for item in items if item["id"] in ids[:2]
    }
    assert sold_data["earned"] == sum(selected_prices.values())

    resell = await client.post(
        "/api/inventory/sell-bulk",
        headers=headers,
        json={"ids": ids[:2]},
    )
    assert resell.status_code == 409

    remaining = await client.get("/api/inventory", headers=headers)
    remaining_items = remaining.json()
    single = remaining_items[0]
    single_sale = await client.post(
        f"/api/inventory/{single['id']}/sell",
        headers=headers,
    )
    assert single_sale.status_code == 200, single_sale.text
    assert single_sale.json()["sold_price"] == single["domain"]["price"]

    # Deterministic successful upgrade.
    monkeypatch.setattr(upgrades, "rng", FakeRng())
    remaining = await client.get("/api/inventory", headers=headers)
    remaining_ids = [item["id"] for item in remaining.json()]
    assert len(remaining_ids) >= 1
    preview = await client.post(
        "/api/upgrade/preview",
        headers=headers,
        json={"domain_ids": remaining_ids[:1], "chance_sector": 75},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["target_value"] == preview.json()["domain"]["price"]
    upgrade = await client.post(
        "/api/upgrade",
        headers=headers,
        json={"domain_ids": remaining_ids[:1], "chance_sector": 75},
    )
    assert upgrade.status_code == 200, upgrade.text
    upgrade_data = upgrade.json()
    assert upgrade_data["success"] is True
    assert upgrade_data["chance"] >= 75
    assert upgrade_data["domain"] is not None
    assert upgrade_data["burned_ids"] == remaining_ids[:1]

    leaderboard_response = await client.get("/api/leaderboard", headers=headers)
    assert leaderboard_response.status_code == 200
    assert leaderboard_response.json()["entries"][0]["user_id"] == user_id

    me_after = await client.get("/api/me", headers=headers)
    assert me_after.status_code == 200
    assert me_after.json()["stats"]["collection_by_rarity"]


async def test_leaderboard_ranks_are_unique_and_ties_use_username(test_context):
    _client, Session, _fake = test_context
    async with Session() as session:
        alpha = User(
            telegram_id=910001,
            username="alpha",
            display_name="Alpha",
            total_spins=25,
        )
        zeta = User(
            telegram_id=910002,
            username="zeta",
            display_name="Zeta",
            total_spins=180,
        )
        session.add_all([alpha, zeta])
        await session.flush()
        domain = await session.scalar(select(Domain).limit(1))
        assert domain is not None
        now = datetime.now(timezone.utc)
        session.add_all(
            [
                Inventory(user_id=alpha.id, domain_id=domain.id, acquired_at=now),
                Inventory(user_id=zeta.id, domain_id=domain.id, acquired_at=now),
            ]
        )
        await session.commit()

        entries, _me, _players = await get_leaderboard(session, zeta.id)
        assert [entry.rank for entry in entries[:2]] == [1, 2]
        assert [entry.username for entry in entries[:2]] == ["alpha", "zeta"]
        assert entries[0].level == 2
        assert entries[1].level == 5


async def test_auth_rejects_bad_init_data(test_context):
    client, _Session, _fake = test_context
    response = await client.post(
        "/api/auth/telegram",
        json={"init_data": "auth_date=1&hash=deadbeef&user=%7B%7D"},
    )
    assert response.status_code in {401, 503}


async def test_earn_click_adds_exactly_one_coin(test_context):
    client, _Session, _fake = test_context
    _payload, headers = await _auth(client)
    me = await client.get("/api/me", headers=headers)
    assert me.json()["user"]["balance"] == 2000

    first = await client.post("/api/earnings/click", headers=headers)
    second = await client.post("/api/earnings/click", headers=headers)
    held = await client.post("/api/earnings/hold", headers=headers)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert held.status_code == 200, held.text
    assert first.json() == {"earned": 1, "balance": 2001}
    assert second.json() == {"earned": 1, "balance": 2002}
    assert held.json() == {"earned": 5, "balance": 2007}

    me_after = await client.get("/api/me", headers=headers)
    assert me_after.json()["user"]["balance"] == 2007


async def test_triple_spin_and_custom_upgrade_chance(test_context):
    client, _Session, _fake = test_context
    _payload, headers = await _auth(client)

    triple = await client.post("/api/spin", headers=headers, json={"roll_type": "normal", "times": 3})
    assert triple.status_code == 200, triple.text
    data = triple.json()
    assert data["times"] == 3
    assert data["balance"] == 1700
    assert data["total_cost"] == 300
    assert len(data["items"]) == 3
    assert all(item["inventory_id"] is not None for item in data["items"])

    preview = await client.post(
        "/api/upgrade/preview",
        headers=headers,
        json={
            "domain_ids": [data["items"][0]["inventory_id"]],
            "chance_sector": 75,
            "chance": 75.17,
        },
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["target_value"] == preview.json()["domain"]["price"]

    custom_upgrade = await client.post(
        "/api/upgrade",
        headers=headers,
        json={
            "domain_ids": [data["items"][0]["inventory_id"]],
            "chance_sector": 50,
            "chance": 1,
        },
    )
    assert custom_upgrade.status_code == 200, custom_upgrade.text
    assert custom_upgrade.json()["chance"] == 1


async def test_daily_bonus_is_25_percent_of_balance(test_context):
    client, _Session, _fake = test_context
    _payload, headers = await _auth(client)

    me = await client.get("/api/me", headers=headers)
    assert me.json()["stats"]["daily_bonus"] == 500
    assert me.json()["stats"]["can_daily_bonus"] is True

    claimed = await client.post("/api/daily-bonus", headers=headers)
    assert claimed.status_code == 200, claimed.text
    assert claimed.json()["amount"] == 500
    assert claimed.json()["balance"] == 2500

    repeated = await client.post("/api/daily-bonus", headers=headers)
    assert repeated.status_code == 429


async def test_admin_can_grant_balance_and_ban(test_context):
    client, _Session, _fake = test_context
    normal_payload, normal_headers = await _auth(client, 900001, "regular")
    admin_payload, admin_headers = await _auth(client, 900002, "anxiohalcy")
    normal_id = normal_payload["user"]["id"]

    assert admin_payload["user"]["is_admin"] is True
    forbidden = await client.get("/api/admin/users", headers=normal_headers)
    assert forbidden.status_code == 403

    overview = await client.get("/api/admin/overview", headers=admin_headers)
    assert overview.status_code == 200
    assert overview.json()["users"] == 2

    granted = await client.post(
        f"/api/admin/users/{normal_id}/balance",
        headers=admin_headers,
        json={"amount": 500},
    )
    assert granted.status_code == 200, granted.text
    assert granted.json()["balance"] == 2500

    banned = await client.post(
        f"/api/admin/users/{normal_id}/ban",
        headers=admin_headers,
        json={"banned": True, "reason": "test ban"},
    )
    assert banned.status_code == 200, banned.text
    assert banned.json()["is_banned"] is True

    blocked = await client.get("/api/me", headers=normal_headers)
    assert blocked.status_code == 403

    unban = await client.post(
        f"/api/admin/users/{normal_id}/ban",
        headers=admin_headers,
        json={"banned": False},
    )
    assert unban.status_code == 200
    restored = await client.get("/api/me", headers=normal_headers)
    assert restored.status_code == 200

    domain = await client.post(
        f"/api/admin/users/{normal_id}/grant-domain",
        headers=admin_headers,
        json={"rarity": "rare"},
    )
    assert domain.status_code == 200, domain.text
    assert domain.json()["domain"]["rarity"] == "rare"


async def test_admin_cannot_ban_self(test_context):
    client, _Session, _fake = test_context
    payload, headers = await _auth(client, 900003, "anxiohalcy")
    response = await client.post(
        f"/api/admin/users/{payload['user']['id']}/ban",
        headers=headers,
        json={"banned": True},
    )
    assert response.status_code == 422


async def test_keep_auto_sold_spin(test_context):
    client, _Session, fake = test_context
    payload, headers = await _auth(client, 900010, "keeper")
    user_id = payload["user"]["id"]

    response = await client.put(
        "/api/settings/autosell",
        headers=headers,
        json={
            "autosell_common": True,
            "autosell_rare": True,
            "autosell_epic": True,
            "autosell_legendary": True,
            "autosell_mythic": True,
            "autosell_below_price": None,
        },
    )
    assert response.status_code == 200

    spin = await client.post("/api/spin", headers=headers, json={"roll_type": "normal"})
    assert spin.status_code == 200, spin.text
    data = spin.json()
    assert data["auto_sold"] is True
    assert data["inventory_id"] is None
    before_keep = data["balance"]

    kept = await client.post(f"/api/spin/{data['id']}/keep", headers=headers)
    assert kept.status_code == 200, kept.text
    kept_data = kept.json()
    assert kept_data["inventory_id"] is not None
    assert kept_data["balance"] == before_keep - data["auto_sold_price"]

    inventory = await client.get("/api/inventory", headers=headers)
    assert len(inventory.json()) == 1
    assert inventory.json()[0]["id"] == kept_data["inventory_id"]

    repeated = await client.post(f"/api/spin/{data['id']}/keep", headers=headers)
    assert repeated.status_code == 409


async def test_mythic_roulette_is_gone(test_context):
    client, _Session, _fake = test_context
    _payload, headers = await _auth(client)
    response = await client.post("/api/spin", headers=headers, json={"roll_type": "mythic"})
    assert response.status_code == 422


async def test_settings_validation(test_context):
    client, _Session, _fake = test_context
    _payload, headers = await _auth(client)
    response = await client.put(
        "/api/settings/autosell",
        headers=headers,
        json={
            "autosell_common": True,
            "autosell_rare": False,
            "autosell_epic": False,
            "autosell_legendary": False,
            "autosell_mythic": False,
            "autosell_below_price": -5,
        },
    )
    assert response.status_code == 422
