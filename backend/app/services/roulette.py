from __future__ import annotations

import random

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.economy import Rarity, SpinType
from app.models import Domain


def choose_rarity(
    roll: SpinType,
    chances: dict[Rarity, float] | None = None,
) -> Rarity:
    """Choose a rarity from the configured chance table (with luck applied)."""
    table = chances or roll["rarity_chances"]
    rarities = list(table.keys())
    weights = [table[rarity] for rarity in rarities]
    return random.choices(rarities, weights=weights, k=1)[0]


async def random_domain_in_rarity(db: AsyncSession, rarity: Rarity) -> Domain | None:
    """Weighted real-domain pick: cheaper domains are more likely.

    ``domains.weight`` already contains the inverse-price bias. PostgreSQL does
    the weighted key extraction in SQL; the SQLite test path uses
    ``random.choices`` over a compact catalog.
    """
    where = (Domain.is_available.is_(True), Domain.rarity == rarity)
    if db.get_bind().dialect.name == "postgresql":
        return await db.scalar(
            select(Domain)
            .where(*where)
            .order_by(-func.ln(func.random()) / Domain.weight)
            .limit(1)
        )

    rows = (
        await db.execute(select(Domain.id, Domain.weight).where(*where))
    ).all()
    if not rows:
        return None
    ids = [row.id for row in rows]
    weights = [max(float(row.weight), 1e-9) for row in rows]
    chosen_id = random.choices(ids, weights=weights, k=1)[0]
    return await db.get(Domain, chosen_id)


async def weighted_random_domain(
    db: AsyncSession,
    rarities: tuple[Rarity, ...],
) -> Domain | None:
    """Pick a domain with probability proportional to ``domains.weight``.

    PostgreSQL performs the weighted key extraction in the database so a
    100k-row catalog does not have to be transferred to Python.  SQLite is
    used by tests and gets an in-memory ``random.choices`` fallback.
    """
    where = [Domain.is_available.is_(True), Domain.rarity.in_(rarities)]
    dialect = db.get_bind().dialect.name

    if dialect == "postgresql":
        # Efraimidis-Spirakis weighted sampling: min(E_i / w_i).
        statement = (
            select(Domain)
            .where(*where)
            .order_by(-func.ln(func.random()) / Domain.weight)
            .limit(1)
        )
        return await db.scalar(statement)

    pool = (await db.scalars(select(Domain).where(*where))).all()
    if not pool:
        return None
    weights = [max(float(domain.weight), 1e-9) for domain in pool]
    return random.choices(pool, weights=weights, k=1)[0]
