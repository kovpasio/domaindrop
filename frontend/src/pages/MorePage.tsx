import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Check,
  ChevronRight,
  Lock,
  Radio,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { api } from '@/api/client';
import { PageTitle } from '@/components/PageTitle';
import { useAuth } from '@/context/AuthContext';
import type { Achievement } from '@/types';
import { formatNumber } from '@/lib/utils';

const LINKS = [
  {
    to: '/leaderboard',
    label: 'Рейтинг',
    description: 'Топ-20 коллекций по сумме цен',
    icon: Trophy,
    color: '#F2A54A',
  },
  {
    to: '/drops',
    label: 'Лента дропов',
    description: 'Последние 20 выпадений в реальном времени',
    icon: Radio,
    color: '#4D9BFF',
  },
  {
    to: '/settings',
    label: 'Настройки',
    description: 'Автопродажа по редкости и цене',
    icon: Settings2,
    color: '#B07CFF',
  },
];

export function MorePage() {
  const { me } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementLuck, setAchievementLuck] = useState(0);

  useEffect(() => {
    void api
      .achievements()
      .then((response) => {
        setAchievements(response.achievements);
        setAchievementLuck(response.total_luck);
      })
      .catch(() => undefined);
  }, []);

  const links = me?.user.is_admin
    ? [
        {
          to: '/admin',
          label: 'Админка',
          description: 'Баланс, баны и выдача доменов',
          icon: Shield,
          color: '#43D6C5',
        },
        ...LINKS,
      ]
    : LINKS;

  return (
    <div>
      <PageTitle
        eyebrow="navigation"
        title="Ещё"
        description="Рейтинг, живая лента и настройки автопродажи."
      />

      <div className="space-y-2">
        {links.map(({ to, label, description, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-ink-800 p-4 transition hover:border-white/[0.12] active:scale-[0.99]"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg border"
              style={{ borderColor: `${color}30`, background: `${color}10`, color }}
            >
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-paper">{label}</div>
              <div className="mt-0.5 truncate text-[9px] text-muted">{description}</div>
            </div>
            <ChevronRight size={15} className="text-muted/50" />
          </Link>
        ))}
      </div>

      {me && (
        <section className="mt-4 rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
          <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-paper">
            <BarChart3 size={13} className="text-accent-soft" /> Статистика
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Всего спинов', value: formatNumber(me.user.total_spins), accent: 'text-paper' },
              { label: 'Заработано', value: `${formatNumber(me.stats.total_earned)} D`, accent: 'text-teal' },
              { label: 'Потрачено', value: `${formatNumber(me.stats.total_spent)} D`, accent: 'text-gold' },
              { label: 'Лучший дроп', value: `${formatNumber(me.stats.best_drop)} D`, accent: 'text-rarity-legendary' },
              { label: 'Mythic-дропы', value: formatNumber(me.stats.mythic_drops), accent: 'text-rarity-mythic' },
              {
                label: 'Апгрейды',
                value: `${formatNumber(me.stats.upgrades_success)} / ${formatNumber(me.stats.upgrades_total)}`,
                accent: 'text-accent-soft',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/[0.05] bg-ink-900/60 px-3 py-2.5">
                <div className="text-[7px] uppercase tracking-[0.1em] text-muted/50">{item.label}</div>
                <div className={`mt-1 truncate font-display text-[13px] font-semibold ${item.accent}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[8px] text-muted/45">
            <TrendingUp size={10} /> Крупнейшая продажа: {formatNumber(me.stats.biggest_sale)} D
          </div>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-paper">
            <Trophy size={13} className="text-gold" /> Достижения
          </div>
          <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[8px] font-bold text-gold">
            +{achievementLuck.toFixed(1)}% удачи
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          {achievements.length === 0 ? (
            <div className="text-[9px] text-muted/50">Загрузка достижений…</div>
          ) : (
            achievements.map((achievement) => (
              <div
                key={achievement.key}
                className={`rounded-xl border px-2.5 py-2 ${
                  achievement.unlocked
                    ? 'border-teal/20 bg-teal/[0.06]'
                    : 'border-white/[0.05] bg-ink-900/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {achievement.unlocked ? (
                    <Check size={12} className="shrink-0 text-teal" />
                  ) : (
                    <Lock size={11} className="shrink-0 text-muted/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[9px] font-semibold ${achievement.unlocked ? 'text-paper' : 'text-muted'}`}>
                        {achievement.title}
                      </span>
                      <span className="shrink-0 text-[7px] font-bold text-gold">+{achievement.luck}%</span>
                    </div>
                    <div className="mt-0.5 truncate text-[7px] text-muted/55">{achievement.description}</div>
                  </div>
                </div>
                {!achievement.unlocked && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-teal"
                        style={{ width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[7px] tabular-nums text-muted/50">
                      {achievement.progress}/{achievement.target}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[8px] text-muted/45">
          <Target size={10} /> Достижения дают удачу автоматически и не влияют на место в рейтинге.
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-accent/15 bg-gradient-to-br from-accent/[0.07] to-transparent p-4">
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-accent-soft">
          <Sparkles size={13} />
          Как играть
        </div>
        <div className="space-y-2">
          {[
            'Крути рулетку и собирай реальные доменные имена.',
            'Оставляй их в коллекции или продавай за монеты.',
            'Апгрейди домены и поднимайся в рейтинге игроков.',
          ].map((step, index) => (
            <div key={step} className="flex items-start gap-2 text-[9px] leading-relaxed text-muted">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[7px] font-bold text-accent-soft">
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.05] bg-ink-800/60 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted">
          <ShieldCheck size={13} className="text-accent-soft" />
          О приложении
        </div>
        <p className="text-[9px] leading-relaxed text-muted/70">
          Domain Drop — игровая рулетка. В каталоге используются реальные зарегистрированные
          доменные имена из публичного рейтинга, но это только игровые карточки: приложение не
          продаёт домены, не регистрирует их и не передаёт права. Цены и редкость — игровые.
          Монеты нельзя купить или вывести.
        </p>
      </div>

      <p className="mt-5 pb-1 text-center text-[8px] uppercase tracking-[0.18em] text-muted/35">
        Domain Drop · v1.0 · учебный проект
      </p>
    </div>
  );
}
