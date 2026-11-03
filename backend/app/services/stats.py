from __future__ import annotations

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.economy import RARITY_ORDER
from app.models import Domain, Inventory, User
from app.schemas import LeaderboardEntry
from app.services.luck import level_index


def _scores_cte():
    """Collection score = sum of sell prices of all unsold domains."""
    return (
        select(
            User.id.label("user_id"),
            User.username.label("username"),
            User.display_name.label("display_name"),
            User.avatar_url.label("avatar_url"),
            User.total_spins.label("total_spins"),
            func.coalesce(func.sum(Domain.price), 0).label("score"),
            func.count(Inventory.id).label("domains_count"),
        )
        .select_from(User)
        .outerjoin(
            Inventory,
            and_(Inventory.user_id == User.id, Inventory.sold_at.is_(None)),
        )
        .outerjoin(Domain, Domain.id == Inventory.domain_id)
        .group_by(
            User.id,
            User.username,
            User.display_name,
            User.avatar_url,
        )
        .cte("collection_scores")
    )


def _ranked_cte():
    scores = _scores_cte()
    return select(
        scores,
        func.row_number()
        .over(
            order_by=(
                scores.c.score.desc(),
                func.lower(func.coalesce(scores.c.username, scores.c.display_name, "")).asc(),
                scores.c.user_id.asc(),
            )
        )
        .label("rank"),
    ).cte("ranked_collections")


def _row_to_entry(row, me_id: int | None = None) -> LeaderboardEntry:
    return LeaderboardEntry(
        rank=int(row.rank),
        user_id=int(row.user_id),
        username=row.username or row.display_name,
        display_name=row.display_name,
        avatar_url=row.avatar_url,
        score=int(row.score),
        domains_count=int(row.domains_count),
        level=level_index(int(row.total_spins or 0)) + 1,
        is_me=me_id is not None and int(row.user_id) == me_id,
    )


async def collection_stats(session: AsyncSession, user_id: int) -> tuple[int, int]:
    row = (
        await session.execute(
            select(
                func.count(Inventory.id),
                func.coalesce(func.sum(Domain.price), 0),
            )
            .select_from(Inventory)
            .join(Domain, Domain.id == Inventory.domain_id)
            .where(Inventory.user_id == user_id, Inventory.sold_at.is_(None))
        )
    ).one()
    return int(row[0]), int(row[1])


async def collection_breakdown(session: AsyncSession, user_id: int) -> dict[str, int]:
    rows = (
        await session.execute(
            select(Domain.rarity, func.count(Inventory.id))
            .select_from(Inventory)
            .join(Domain, Domain.id == Inventory.domain_id)
            .where(Inventory.user_id == user_id, Inventory.sold_at.is_(None))
            .group_by(Domain.rarity)
        )
    ).all()
    counts = {rarity: 0 for rarity in RARITY_ORDER}
    for rarity, count in rows:
        counts[str(rarity)] = int(count)
    return counts


async def user_rank(session: AsyncSession, user_id: int) -> int:
    ranked = _ranked_cte()
    rank = await session.scalar(select(ranked.c.rank).where(ranked.c.user_id == user_id))
    return int(rank or 0)


async def total_players(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(User)) or 0)


async def leaderboard(
    session: AsyncSession, user_id: int, limit: int = 20
) -> tuple[list[LeaderboardEntry], LeaderboardEntry | None, int]:
    ranked = _ranked_cte()
    rows = (
        await session.execute(
            select(ranked)
            .order_by(ranked.c.rank.asc(), ranked.c.user_id.asc())
            .limit(limit)
        )
    ).all()
    entries = [_row_to_entry(row, user_id) for row in rows]

    me_row = (
        await session.execute(select(ranked).where(ranked.c.user_id == user_id))
    ).first()
    me = _row_to_entry(me_row, user_id) if me_row else None
    return entries, me, await total_players(session)
