from __future__ import annotations


ACHIEVEMENTS: tuple[dict, ...] = (
    {
        "key": "first_spin",
        "title": "Первый спин",
        "description": "Сделайте первую крутку",
        "metric": "spins",
        "target": 1,
        "luck": 0.5,
    },
    {
        "key": "spins_100",
        "title": "Сотня",
        "description": "Сделайте 100 круток",
        "metric": "spins",
        "target": 100,
        "luck": 0.5,
    },
    {
        "key": "spins_1000",
        "title": "Тысячник",
        "description": "Сделайте 1 000 круток",
        "metric": "spins",
        "target": 1_000,
        "luck": 1.0,
    },
    {
        "key": "spins_5000",
        "title": "Марафонец",
        "description": "Сделайте 5 000 круток",
        "metric": "spins",
        "target": 5_000,
        "luck": 1.5,
    },
    {
        "key": "first_sale",
        "title": "Первая продажа",
        "description": "Продайте первый домен",
        "metric": "sales",
        "target": 1,
        "luck": 0.5,
    },
    {
        "key": "sales_100",
        "title": "Продавец",
        "description": "Продайте 100 доменов",
        "metric": "sales",
        "target": 100,
        "luck": 0.5,
    },
    {
        "key": "first_upgrade",
        "title": "Кузнец",
        "description": "Проведите первый апгрейд",
        "metric": "upgrades",
        "target": 1,
        "luck": 0.5,
    },
    {
        "key": "upgrades_50",
        "title": "Мастер кузницы",
        "description": "Проведите 50 апгрейдов",
        "metric": "upgrades",
        "target": 50,
        "luck": 1.0,
    },
    {
        "key": "first_mythic",
        "title": "Миф",
        "description": "Получите первый Mythic-домен",
        "metric": "mythic",
        "target": 1,
        "luck": 1.0,
    },
    {
        "key": "mythic_10",
        "title": "Коллекционер мифов",
        "description": "Получите 10 Mythic-доменов",
        "metric": "mythic",
        "target": 10,
        "luck": 1.0,
    },
    {
        "key": "best_drop_1m",
        "title": "Миллионник",
        "description": "Получите домен дороже 1 000 000 D",
        "metric": "best_drop",
        "target": 1_000_000,
        "luck": 1.0,
    },
    {
        "key": "collector_50",
        "title": "Коллекционер",
        "description": "Соберите 50 доменов в инвентаре",
        "metric": "collection",
        "target": 50,
        "luck": 0.5,
    },
    {
        "key": "earned_1m",
        "title": "Первый миллион",
        "description": "Заработайте 1 000 000 D с продаж",
        "metric": "earned",
        "target": 1_000_000,
        "luck": 0.5,
    },
    {
        "key": "spins_10000",
        "title": "Легенда рулетки",
        "description": "Сделайте 10 000 круток",
        "metric": "spins",
        "target": 10_000,
        "luck": 1.5,
    },
    {
        "key": "sales_1000",
        "title": "Доменный магнат",
        "description": "Продайте 1 000 доменов",
        "metric": "sales",
        "target": 1_000,
        "luck": 1.0,
    },
    {
        "key": "upgrades_200",
        "title": "Верховный кузнец",
        "description": "Проведите 200 апгрейдов",
        "metric": "upgrades",
        "target": 200,
        "luck": 1.0,
    },
    {
        "key": "mythic_50",
        "title": "Повелитель мифов",
        "description": "Получите 50 Mythic-доменов",
        "metric": "mythic",
        "target": 50,
        "luck": 1.0,
    },
    {
        "key": "best_drop_5m",
        "title": "Пятимиллионник",
        "description": "Получите домен дороже 5 000 000 D",
        "metric": "best_drop",
        "target": 5_000_000,
        "luck": 1.0,
    },
    {
        "key": "collector_200",
        "title": "Хранитель коллекции",
        "description": "Соберите 200 доменов в инвентаре",
        "metric": "collection",
        "target": 200,
        "luck": 0.5,
    },
    {
        "key": "earned_10m",
        "title": "Десять миллионов",
        "description": "Заработайте 10 000 000 D с продаж",
        "metric": "earned",
        "target": 10_000_000,
        "luck": 1.0,
    },
)


def achievement_payload(stats: dict[str, int]) -> tuple[list[dict], float]:
    achievements: list[dict] = []
    total_luck = 0.0
    for item in ACHIEVEMENTS:
        value = int(stats.get(str(item["metric"]), 0))
        target = int(item["target"])
        unlocked = value >= target
        if unlocked:
            total_luck += float(item["luck"])
        achievements.append(
            {
                "key": item["key"],
                "title": item["title"],
                "description": item["description"],
                "target": target,
                "progress": min(target, value),
                "unlocked": unlocked,
                "luck": float(item["luck"]),
            }
        )
    return achievements, round(total_luck, 2)
