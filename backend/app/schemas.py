from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

RarityLiteral = Literal["common", "rare", "epic", "legendary", "mythic"]
RollTypeLiteral = Literal[
    "normal",
    "uncommon_plus",
    "rare_plus",
    "epic_plus",
]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: str | None
    display_name: str
    avatar_url: str | None
    balance: int
    total_spins: int
    is_admin: bool
    is_banned: bool
    created_at: datetime


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    zone: str
    full_name: str
    rarity: RarityLiteral
    weight: float
    price: int
    is_available: bool


class DevUserIn(BaseModel):
    id: int = 100_000_001
    username: str = "demo_pilot"
    first_name: str = "Demo"
    last_name: str | None = None
    photo_url: str | None = None


class TelegramAuthIn(BaseModel):
    init_data: str = Field(
        default="",
        validation_alias=AliasChoices("init_data", "initData"),
    )
    dev_user: DevUserIn | None = None


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MeStats(BaseModel):
    collection_count: int
    collection_value: int
    collection_by_rarity: dict[str, int]
    rank: int | None
    total_players: int
    daily_bonus: int
    daily_available_at: datetime | None
    can_daily_bonus: bool


class LuckProgressOut(BaseModel):
    level: int
    title: str
    total_spins: int
    next_level_spins: int | None
    spins_into_level: int
    spins_to_next: int | None
    level_luck: float
    inventory_luck: float
    total_luck: float


class MeOut(BaseModel):
    user: UserOut
    stats: MeStats
    progress: LuckProgressOut


class SpinIn(BaseModel):
    roll_type: RollTypeLiteral = "normal"


class SpinOut(BaseModel):
    id: int
    roll_type: str
    domain: DomainOut
    rarity: str
    price: int
    balance: int
    auto_sold: bool
    auto_sold_price: int | None
    inventory_id: int | None = None
    created_at: datetime


class KeepSpinOut(BaseModel):
    spin_id: int
    domain: DomainOut
    inventory_id: int
    balance: int


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: DomainOut
    acquired_at: datetime
    sold_at: datetime | None = None
    sold_price: int | None = None


class SellOut(BaseModel):
    item_id: int
    sold_price: int
    balance: int
    domain: DomainOut


class BulkSellIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=5_000)


class BulkSellOut(BaseModel):
    sold: int
    earned: int
    balance: int
    ids: list[int]


class AutosellSettingsOut(BaseModel):
    autosell_common: bool
    autosell_rare: bool
    autosell_epic: bool
    autosell_legendary: bool
    autosell_mythic: bool
    autosell_below_price: int | None


class AutosellSettingsIn(BaseModel):
    autosell_common: bool = False
    autosell_rare: bool = False
    autosell_epic: bool = False
    autosell_legendary: bool = False
    autosell_mythic: bool = False
    autosell_below_price: int | None = Field(default=None, ge=0)


class UpgradeIn(BaseModel):
    domain_ids: list[int] = Field(min_length=1, max_length=50)
    chance_sector: Literal[10, 25, 50, 75]
    chance: float | None = Field(default=None, ge=0, le=100)


class UpgradePreviewIn(BaseModel):
    domain_ids: list[int] = Field(min_length=1, max_length=50)
    chance_sector: Literal[10, 25, 50, 75]
    chance: float | None = Field(default=None, ge=0, le=100)


class UpgradePreviewOut(BaseModel):
    target_value: int
    target_rarity: RarityLiteral
    domain: DomainOut | None


class UpgradeOut(BaseModel):
    id: int
    success: bool
    chance: float
    multiplier: float
    spent_value: int
    target_value: int
    from_domain_ids: list[int]
    burned_ids: list[int]
    domain: DomainOut | None
    balance: int
    created_at: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    display_name: str
    avatar_url: str | None
    score: int
    domains_count: int
    is_me: bool = False


class LeaderboardOut(BaseModel):
    entries: list[LeaderboardEntry]
    me: LeaderboardEntry | None
    total_players: int


class DropOut(BaseModel):
    spin_id: int
    user_id: int
    username: str
    display_name: str
    avatar_url: str | None
    domain: DomainOut
    rarity: str
    price: int
    roll_type: str
    auto_sold: bool
    created_at: datetime


class DropsResponse(BaseModel):
    drops: list[DropOut]


class DailyBonusOut(BaseModel):
    rewarded: bool
    amount: int
    balance: int
    next_available_at: datetime | None
    user: UserOut


class EarnOut(BaseModel):
    earned: int
    balance: int


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: str | None
    display_name: str
    avatar_url: str | None
    balance: int
    total_spins: int
    is_admin: bool
    is_banned: bool
    ban_reason: str | None
    created_at: datetime


class AdminUsersOut(BaseModel):
    users: list[AdminUserOut]
    total: int


class AdminOverviewOut(BaseModel):
    users: int
    banned: int
    admins: int
    total_balance: int
    total_spins: int
    inventory_count: int


class AdminBalanceIn(BaseModel):
    amount: int = Field(ge=-10_000_000_000, le=10_000_000_000)


class AdminBanIn(BaseModel):
    banned: bool
    reason: str | None = Field(default=None, max_length=256)


class AdminGrantIn(BaseModel):
    rarity: RarityLiteral | None = None


class AdminGrantOut(BaseModel):
    domain: DomainOut
    balance: int


class RollTypeOut(BaseModel):
    key: str
    title: str
    short_title: str
    cost: int
    rarities: list[str]
    min_price: int
    description: str


class UpgradeSectorOut(BaseModel):
    sector: int
    multiplier: float
    ev: float


class MetaOut(BaseModel):
    app_name: str
    zones: list[str]
    rarities: list[dict]
    roll_types: list[RollTypeOut]
    upgrade_sectors: list[UpgradeSectorOut]
    economy: dict
    total_domains: int


class HealthOut(BaseModel):
    status: str
    database: str
    redis: str
