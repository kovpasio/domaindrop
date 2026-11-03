from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    TypeDecorator,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.config import settings


class UTCDateTime(TypeDecorator):
    """Always expose timezone-aware UTC datetimes."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False, default="Pilot")
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    balance: Mapped[int] = mapped_column(BigInteger, nullable=False, default=settings.start_balance)
    pity_counter: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_spins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_banned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    ban_reason: Mapped[str | None] = mapped_column(String(256), nullable=True)
    banned_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    last_daily_bonus: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    inventory: Mapped[list[Inventory]] = relationship(back_populates="user")
    settings: Mapped[UserSettings | None] = relationship(back_populates="user", uselist=False)


class CatalogMeta(Base):
    __tablename__ = "catalog_meta"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(128), nullable=False)


class Domain(Base):
    __tablename__ = "domains"
    __table_args__ = (
        UniqueConstraint("name", "zone", name="uq_domains_name_zone"),
        Index("ix_domains_rarity_id", "rarity", "id"),
        Index("ix_domains_available_rarity", "is_available", "rarity"),
        Index("ix_domains_price", "price"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    zone: Mapped[str] = mapped_column(String(8), nullable=False)
    rarity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )

    @property
    def full_name(self) -> str:
        return f"{self.name}{self.zone}"


class Spin(Base):
    __tablename__ = "spins"
    __table_args__ = (Index("ix_spins_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commitment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain_id: Mapped[int] = mapped_column(ForeignKey("domains.id"), nullable=False)
    roll_type: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    rarity: Mapped[str] = mapped_column(String(16), nullable=False)
    base_rarity: Mapped[str] = mapped_column(String(16), nullable=False)
    server_seed: Mapped[str] = mapped_column(String(128), nullable=False)
    server_seed_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    client_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    nonce: Mapped[int] = mapped_column(Integer, nullable=False)
    rarity_roll: Mapped[int] = mapped_column(Integer, nullable=False)
    domain_roll: Mapped[int] = mapped_column(Integer, nullable=False)
    domain_index: Mapped[int] = mapped_column(Integer, nullable=False)
    bucket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    pity_applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    auto_sold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_sold_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )

    domain: Mapped[Domain] = relationship(lazy="joined", innerjoin=True)
    user: Mapped[User] = relationship(lazy="joined")


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        Index("ix_inventory_user_sold", "user_id", "sold_at"),
        Index("ix_inventory_domain", "domain_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain_id: Mapped[int] = mapped_column(ForeignKey("domains.id"), nullable=False)
    acquired_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )
    sold_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    sold_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    user: Mapped[User] = relationship(back_populates="inventory")
    domain: Mapped[Domain] = relationship(lazy="joined", innerjoin=True)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    autosell_common: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    autosell_rare: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    autosell_epic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    autosell_legendary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    autosell_mythic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    autosell_below_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    user: Mapped[User] = relationship(back_populates="settings")


_ID_ARRAY = PG_ARRAY(BigInteger).with_variant(JSON, "sqlite")


class Upgrade(Base):
    __tablename__ = "upgrades"
    __table_args__ = (Index("ix_upgrades_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    from_domain_ids: Mapped[list[int]] = mapped_column(_ID_ARRAY, nullable=False)
    to_domain_id: Mapped[int | None] = mapped_column(
        ForeignKey("domains.id", ondelete="SET NULL"), nullable=True
    )
    chance: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    multiplier: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )

    to_domain: Mapped[Domain | None] = relationship(lazy="joined")
