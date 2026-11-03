"""Small idempotent schema upgrades for existing Docker volumes.

The project deliberately avoids Alembic for this demo.  ``create_all``
creates new tables, while these statements add columns to tables that were
created by an older version.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)

POSTGRES_STATEMENTS = (
    "ALTER TABLE users ALTER COLUMN balance TYPE BIGINT",
    "ALTER TABLE domains ALTER COLUMN price TYPE BIGINT",
    "ALTER TABLE domains ALTER COLUMN weight TYPE DOUBLE PRECISION USING weight::double precision",
    "ALTER TABLE domains ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE spins ADD COLUMN IF NOT EXISTS roll_type VARCHAR(32) NOT NULL DEFAULT 'normal'",
    "ALTER TABLE spins ADD COLUMN IF NOT EXISTS auto_sold BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE spins ADD COLUMN IF NOT EXISTS auto_sold_price BIGINT",
    "ALTER TABLE spins ALTER COLUMN price TYPE BIGINT",
    "ALTER TABLE inventory ALTER COLUMN sold_price TYPE BIGINT",
    "ALTER TABLE upgrades ALTER COLUMN multiplier TYPE NUMERIC(12, 6)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(256)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ",
    "UPDATE users SET is_admin = TRUE WHERE LOWER(TRIM(LEADING '@' FROM COALESCE(username, ''))) = 'anxiohalcy'",
    "CREATE INDEX IF NOT EXISTS ix_domains_available_rarity ON domains (is_available, rarity)",
    "CREATE INDEX IF NOT EXISTS ix_domains_price ON domains (price)",
    # Rebalance existing volumes to the new rarity luck + price curve.
    """UPDATE domains SET weight = (
        CASE rarity
            WHEN 'common' THEN 2.5
            WHEN 'rare' THEN 3.2
            WHEN 'epic' THEN 7.0
            WHEN 'legendary' THEN 6.5
            WHEN 'mythic' THEN 5.5
            ELSE 1.0
        END
    ) / POWER(GREATEST(price, 1), 0.6) WHERE is_available = TRUE""",
)


async def migrate_schema(connection: AsyncConnection) -> None:
    if connection.dialect.name != "postgresql":
        return
    for statement in POSTGRES_STATEMENTS:
        await connection.execute(text(statement))
    logger.info("Existing schema upgraded for the new domain economy")
