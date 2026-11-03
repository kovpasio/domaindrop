from __future__ import annotations

import asyncio
import logging
from html import escape

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("dropzone.bot")


async def run_bot() -> None:
    if not settings.bot_enabled:
        logger.warning(
            "BOT_TOKEN не задан — Telegram-бот выключен. "
            "Mini App и API продолжат работать. Укажите BOT_TOKEN в .env для бота."
        )
        await asyncio.Event().wait()
        return

    bot = Bot(token=settings.bot_token)
    dispatcher = Dispatcher()

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎰 Открыть Domain Drop",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            ]
        ]
    )

    @dispatcher.message(CommandStart())
    async def start(message: Message) -> None:
        name = escape(message.from_user.first_name) if message.from_user else "пилот"
        await message.answer(
            f"Привет, <b>{name}</b>!\n\n"
            "Это <b>Domain Drop</b> — виртуальная рулетка доменов.\n"
            "Крути, собирай коллекцию и поднимайся в топ. "
            "В каталоге реальные доменные имена, но это игровые карточки: "
            "приложение не передаёт права на домены, реальных денег и ставок нет.\n\n"
            "Стартовый баланс — <b>5000 монет</b>. Один обычный спин — <b>95</b>. "
            "Уровень пилота и домены в инвентаре повышают удачу.",
            reply_markup=keyboard,
            parse_mode="HTML",
        )

    @dispatcher.message(Command("help"))
    async def help_command(message: Message) -> None:
        await message.answer(
            "Нажми «Открыть Domain Drop» ниже. Внутри: рулетка, инвентарь, "
            "апгрейдер, настройки автопродажи и живая лента дропов.",
            reply_markup=keyboard,
        )

    @dispatcher.message(F.text)
    async def fallback(message: Message) -> None:
        await message.answer("Открой Mini App кнопкой ниже 👇", reply_markup=keyboard)

    try:
        try:
            await bot.set_my_commands(
                [
                    BotCommand(command="start", description="Открыть Domain Drop"),
                    BotCommand(command="help", description="Как играть"),
                ]
            )
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Играть",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            )
        except Exception:
            logger.exception(
                "Не удалось настроить меню бота. Проверьте, что WEBAPP_URL — публичный HTTPS-адрес."
            )
        logger.info("Bot polling started; WebApp URL=%s", settings.webapp_url)
        await dispatcher.start_polling(bot, allowed_updates=dispatcher.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(run_bot())
