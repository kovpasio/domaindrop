from __future__ import annotations

import logging

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain_generator import generate_domains
from app.economy import MAX_DOMAIN_COUNT
from app.models import CatalogMeta, Domain

logger = logging.getLogger(__name__)
BATCH_SIZE = 5_000
CATALOG_VERSION = "2026-11-03-ladder-1"


async def seed_domains(
    session: AsyncSession,
    target: int = MAX_DOMAIN_COUNT,
) -> None:
    """Refresh the rounded catalog and keep old inventory rows intact."""
    available = int(
        await session.scalar(
            select(func.count()).select_from(Domain).where(Domain.is_available.is_(True))
        )
        or 0
    )
    current_version = await session.scalar(
        select(CatalogMeta.value).where(CatalogMeta.key == "catalog_version")
    )
    if current_version == CATALOG_VERSION and available >= target:
        logger.info("Domain catalog is current (%s available)", available)
        return

    logger.info("Refreshing %s real domains (current available: %s)", target, available)
    domains = generate_domains(target)

    # Old catalogs are kept for historical inventory rows but removed from
    # the roulette pool.
    await session.execute(update(Domain).values(is_available=False))

    dialect = session.get_bind().dialect.name
    for offset in range(0, len(domains), BATCH_SIZE):
        batch = domains[offset : offset + BATCH_SIZE]
        rows = [
            {
                "name": domain.name,
                "zone": domain.zone,
                "rarity": domain.rarity,
                "weight": domain.weight,
                "price": domain.price,
                "is_available": domain.is_available,
            }
            for domain in batch
        ]
        insert_fn = pg_insert if dialect == "postgresql" else sqlite_insert
        statement = insert_fn(Domain).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["name", "zone"],
            set_={
                "rarity": statement.excluded.rarity,
                "weight": statement.excluded.weight,
                "price": statement.excluded.price,
                "is_available": statement.excluded.is_available,
            },
        )
        await session.execute(statement)
        logger.info(
            "Seeded %s/%s domains",
            min(offset + len(batch), len(domains)),
            len(domains),
        )

    version_row = await session.scalar(
        select(CatalogMeta).where(CatalogMeta.key == "catalog_version")
    )
    if version_row is None:
        session.add(CatalogMeta(key="catalog_version", value=CATALOG_VERSION))
    else:
        version_row.value = CATALOG_VERSION
    await session.commit()
    logger.info("Seeded %s real domains", len(domains))
