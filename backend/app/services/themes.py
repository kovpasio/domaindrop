from __future__ import annotations

THEMES: tuple[dict, ...] = (
    {
        "key": "mono",
        "title": "Монохром",
        "description": "Спокойный графитовый стиль",
        "primary": "#D7DEEA",
        "secondary": "#26272B",
    },
    {
        "key": "midnight",
        "title": "Полночь",
        "description": "Базовый тёмно-синий стиль",
        "primary": "#4F9DFF",
        "secondary": "#182334",
    },
    {
        "key": "ocean",
        "title": "Океан",
        "description": "Глубокий сине-зелёный",
        "primary": "#2ED6BE",
        "secondary": "#0E2C36",
    },
    {
        "key": "violet",
        "title": "Фиалка",
        "description": "Тёмный фиолетовый",
        "primary": "#B27CFF",
        "secondary": "#241C3C",
    },
    {
        "key": "sunset",
        "title": "Закат",
        "description": "Тёплый красно-оранжевый",
        "primary": "#FF965C",
        "secondary": "#39231F",
    },
    {
        "key": "emerald",
        "title": "Изумруд",
        "description": "Тёмный зелёный",
        "primary": "#45D68A",
        "secondary": "#102D1F",
    },
)

THEME_KEYS = tuple(theme["key"] for theme in THEMES)
THEME_BY_KEY = {theme["key"]: theme for theme in THEMES}
THEME_TITLES = {theme["key"]: theme["title"] for theme in THEMES}
DEFAULT_THEME = "mono"
