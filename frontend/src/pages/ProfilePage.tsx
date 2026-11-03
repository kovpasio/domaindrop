import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpFromLine,
  ArrowUpRight,
  ChevronRight,
  Coins,
  Gift,
  Layers,
  Settings2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ApiError, api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { Avatar } from '@/components/Avatar';
import { Coin } from '@/components/Coin';
import { SectionTitle } from '@/components/SectionTitle';
import { StatTile } from '@/components/StatTile';
import {
  cn,
  countdown,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
  RARITY_ORDER,
  timeAgo,
} from '@/lib/utils';

export function ProfilePage() {
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin } = useSound();
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!me) return null;
  const { user, stats, progress } = me;
  const currentLevelStart = progress.total_spins - progress.spins_into_level;
  const levelSpan =
    progress.next_level_spins != null
      ? Math.max(1, progress.next_level_spins - currentLevelStart)
      : 1;
  const levelRatio =
    progress.next_level_spins != null
      ? Math.min(100, (progress.spins_into_level / levelSpan) * 100)
      : 100;
  const nextAvailable = stats.daily_available_at ? new Date(stats.daily_available_at).getTime() : 0;
  const dailyReady = nextAvailable <= now;
  const maxCount = Math.max(1, ...RARITY_ORDER.map((rarity) => stats.collection_by_rarity?.[rarity] ?? 0));

  async function claimDaily() {
    if (!dailyReady || claiming) return;
    setClaiming(true);
    hapticImpact('light');
    try {
      const result = await api.dailyBonus();
      playCoin();
      hapticNotify('success');
      toast(`Ежедневный бонус +${result.amount} D`, 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Не удалось получить бонус', 'error');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/[0.07] bg-ink-800 p-4 shadow-soft">
        <div className="flex items-start gap-3.5">
          <Avatar src={user.avatar_url} name={user.display_name} size={68} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-accent-soft">
                pilot
              </span>
              {stats.rank && (
                <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-semibold text-muted">
                  <Trophy size={9} />
                  #{stats.rank}
                </span>
              )}
            </div>
            <h1 className="truncate font-display text-xl font-semibold leading-tight text-paper">
              {user.display_name}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {user.username ? `@${user.username}` : 'anonymous pilot'}
            </p>
            <p className="mt-1.5 text-[9px] text-muted/60">
              В системе {timeAgo(user.created_at)} · {formatNumber(user.total_spins)} спинов
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between rounded-xl border border-white/[0.06] bg-ink-900 px-3.5 py-3">
          <div>
            <div className="label mb-1.5">Баланс</div>
            <div className="flex items-center gap-2">
              <Coin size={24} />
              <span className="font-display text-[30px] font-semibold leading-none tracking-tight text-paper">
                {formatNumber(user.balance)}
              </span>
              <span className="mb-0.5 text-[10px] font-semibold text-muted">D</span>
            </div>
          </div>
          <Link
            to="/roulette"
            onClick={() => hapticImpact('light')}
            className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[10px] font-semibold text-accent-soft transition active:scale-95"
          >
            Крутить
            <ArrowUpRight size={12} />
          </Link>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatTile
            icon={Layers}
            label="Домены"
            value={formatNumber(stats.collection_count)}
            hint="в коллекции"
          />
          <StatTile
            icon={Coins}
            label="Сумма"
            value={formatNumber(stats.collection_value)}
            hint="цена"
            accent="#4F9DFF"
          />
          <StatTile
            icon={Trophy}
            label="Место"
            value={stats.rank ? `#${stats.rank}` : '—'}
            hint={`из ${stats.total_players}`}
            accent="#F2A54A"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-teal/20 bg-gradient-to-br from-teal/[0.08] via-ink-800 to-accent/[0.05] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-teal">
              <Sparkles size={11} /> пилотский уровень
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-paper">
              {progress.level} · {progress.title}
            </div>
          </div>
          <div className="rounded-lg border border-teal/25 bg-teal/10 px-2.5 py-1.5 text-right">
            <div className="text-[7px] uppercase tracking-[0.1em] text-muted/60">удача</div>
            <div className="font-display text-[13px] font-semibold text-teal">
              +{progress.total_luck.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal to-accent transition-all duration-500"
            style={{ width: `${levelRatio}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[8px] text-muted/70">
          <span>
            {progress.next_level_spins != null
              ? `${formatNumber(progress.spins_into_level)} / ${formatNumber(levelSpan)} спинов`
              : 'максимальный уровень'}
          </span>
          <span>
            {progress.next_level_spins != null
              ? `до следующего: ${formatNumber(progress.spins_to_next ?? 0)}`
              : 'все бонусы открыты'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
          <div>
            <div className="text-[7px] uppercase tracking-[0.1em] text-muted/60">за спины</div>
            <div className="mt-0.5 font-display text-[11px] font-semibold text-paper">
              +{progress.level_luck.toFixed(1)}% удачи
            </div>
          </div>
          <div>
            <div className="text-[7px] uppercase tracking-[0.1em] text-muted/60">за инвентарь</div>
            <div className="mt-0.5 font-display text-[11px] font-semibold text-paper">
              +{progress.inventory_luck.toFixed(1)}% удачи
            </div>
          </div>
        </div>
        <p className="mt-2 text-[8px] leading-relaxed text-muted/50">
          Удача сдвигает шансы в сторону Rare+. Домены в инвентаре усиливают бонус, пока вы их не
          продали.
        </p>
      </section>

      <button
        type="button"
        onClick={claimDaily}
        disabled={!dailyReady || claiming}
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.99]',
          dailyReady
            ? 'border-rarity-legendary/25 bg-rarity-legendary/[0.06]'
            : 'border-white/[0.06] bg-ink-800/60',
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
              dailyReady
                ? 'border-rarity-legendary/25 bg-rarity-legendary/10 text-rarity-legendary'
                : 'border-white/[0.07] bg-white/[0.03] text-muted/60',
            )}
          >
            <Gift size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-[12px] font-semibold text-paper">
                Ежедневный бонус
              </span>
              {dailyReady && (
                <span className="rounded bg-rarity-legendary/15 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-rarity-legendary">
                  ready
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[9px] text-muted">
              {dailyReady
                ? `Заберите +${formatNumber(stats.daily_bonus)} D на новые спины`
                : `Следующий через ${countdown(stats.daily_available_at)}`}
            </p>
          </div>
          <div className="text-right">
            <div className={cn('font-display text-[15px] font-semibold', dailyReady ? 'text-rarity-legendary' : 'text-muted/60')}>
              {claiming ? '…' : `+${formatNumber(stats.daily_bonus)}`}
            </div>
            <div className="mt-0.5 text-[8px] text-muted/60">каждые 24ч</div>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/upgrader"
          className="rounded-2xl border border-white/[0.06] bg-ink-800 p-3.5 transition active:scale-[0.99]"
        >
          <ArrowUpFromLine size={17} className="mb-2.5 text-accent-soft" />
          <div className="text-[11px] font-semibold text-paper">Апгрейдер</div>
          <div className="mt-0.5 text-[9px] text-muted">Объединить домены</div>
        </Link>
        <Link
          to="/settings"
          className="rounded-2xl border border-white/[0.06] bg-ink-800 p-3.5 transition active:scale-[0.99]"
        >
          <Settings2 size={17} className="mb-2.5 text-muted" />
          <div className="text-[11px] font-semibold text-paper">Автопродажа</div>
          <div className="mt-0.5 text-[9px] text-muted">Настройки дропа</div>
        </Link>
      </div>

      <section>
        <SectionTitle
          action={
            <Link
              to="/inventory"
              className="flex items-center gap-0.5 text-[9px] font-medium text-muted transition hover:text-paper"
            >
              Вся коллекция <ChevronRight size={11} />
            </Link>
          }
        >
          Состав коллекции
        </SectionTitle>
        <div className="rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
          {stats.collection_count === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <Sparkles size={20} className="mb-2 text-muted/40" />
              <p className="text-[11px] text-muted">Коллекция пока пуста</p>
              <Link
                to="/roulette"
                className="mt-2 text-[10px] font-medium text-accent-soft underline decoration-accent/30 underline-offset-4"
              >
                Сделать первый спин
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {RARITY_ORDER.map((rarity) => {
                const count = stats.collection_by_rarity?.[rarity] ?? 0;
                const meta = RARITY[rarity];
                return (
                  <div key={rarity} className="flex items-center gap-3">
                    <div className="w-[68px] shrink-0 text-[8px] font-semibold uppercase tracking-[0.1em]" style={{ color: meta.color }}>
                      {meta.label}
                    </div>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxCount) * 100}%` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: meta.color }}
                      />
                    </div>
                    <div className="w-6 text-right font-display text-[11px] font-semibold tabular-nums text-muted">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-center gap-1.5 pb-1 text-[9px] text-muted/50">
        <Sparkles size={10} />
        Все домены виртуальные. Реальных регистраций и денег нет.
      </div>
    </div>
  );
}
