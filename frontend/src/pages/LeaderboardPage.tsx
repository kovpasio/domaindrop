import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, RefreshCw, Shield, Trophy, Users } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { PageTitle } from '@/components/PageTitle';
import type { LeaderboardEntry, LeaderboardResponse } from '@/types';
import { cn, formatNumber, hapticImpact } from '@/lib/utils';

export function LeaderboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.leaderboard());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось загрузить рейтинг', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = data?.entries ?? [];
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = data?.me;
  const meInTop = me ? entries.some((entry) => entry.user_id === me.user_id) : false;

  return (
    <div>
      <PageTitle
        eyebrow="global ranks"
        title="Рейтинг"
        description="Топ-20 игроков по силе коллекции — сумме цен всех непроданных доменов."
        action={
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              void load();
            }}
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/45 transition hover:text-white active:scale-95"
            aria-label="Обновить рейтинг"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <Users size={13} className="text-neon-cyan" />
          {data?.total_players ?? '—'} участников
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-white/22">
          <Shield size={10} /> сезон 01
        </div>
      </div>

      {loading && !data ? (
        <LeaderboardSkeleton />
      ) : (
        <>
          {top.length > 0 && (
            <div className="mb-5 grid grid-cols-3 items-end gap-1.5">
              {[1, 0, 2].map((place) => {
                const entry = top[place];
                if (!entry) return <div key={place} />;
                return (
                  <PodiumCard
                    key={entry.user_id}
                    entry={entry}
                    place={place}
                    isMe={entry.is_me}
                  />
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            {rest.map((entry, index) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.025, 0.3) }}
              >
                <RankRow entry={entry} />
              </motion.div>
            ))}
          </div>

          {rest.length === 0 && top.length > 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.07] px-4 py-6 text-center text-[10px] text-white/25">
              Пока только эти игроки ворвались в таблицу.
            </div>
          )}

          {me && !meInTop && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky bottom-28 z-10 mt-4"
            >
              <div className="relative mb-2 flex items-center justify-between">
                <span className="label">Ваша позиция</span>
                <Trophy size={12} className="text-neon-lime" />
              </div>
              <RankRow entry={me} highlight />
            </motion.div>
          )}

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.022] p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
              <Trophy size={12} className="text-rarity-legendary" /> Как считается место
            </div>
            <p className="text-[10px] leading-relaxed text-white/28">
              Сила коллекции = сумма цен всех непроданных доменов. Продажа снижает ваш рейтинг,
              поэтому решайте: забрать монеты сейчас или побороться за вершину.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function PodiumCard({
  entry,
  place,
  isMe,
}: {
  entry: LeaderboardEntry;
  place: number;
  isMe: boolean;
}) {
  const config = [
    {
      ring: 'border-[#F2A54A]/50 bg-gradient-to-b from-[#F2A54A]/18 to-white/[0.02]',
      badge: 'bg-[#F2A54A] text-[#2a1a00]',
      size: 78,
      label: '1',
      icon: Crown,
      height: 'pt-7',
    },
    {
      ring: 'border-white/20 bg-gradient-to-b from-white/[0.1] to-white/[0.02]',
      badge: 'bg-[#d7deea] text-[#171b24]',
      size: 60,
      label: '2',
      icon: Medal,
      height: 'pt-4',
    },
    {
      ring: 'border-[#D0895A]/40 bg-gradient-to-b from-[#D0895A]/12 to-white/[0.02]',
      badge: 'bg-[#D0895A] text-[#28150a]',
      size: 60,
      label: '3',
      icon: Medal,
      height: 'pt-4',
    },
  ][place];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-2xl border px-1.5 pb-4 text-center',
        config.ring,
        config.height,
        isMe && 'ring-1 ring-neon-lime/60',
      )}
    >
      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full">
        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold', config.badge)}>
          {config.label}
        </span>
      </div>
      {place === 0 && (
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-2 text-[#F2A54A]"
        >
          <Icon size={14} />
        </motion.div>
      )}
      <Avatar src={entry.avatar_url} name={entry.display_name} size={config.size} glow={place === 0} />
      <div className="mt-2.5 w-full truncate font-display text-[11px] font-bold text-white">
        {entry.display_name}
      </div>
      <div className="w-full truncate text-[8px] text-white/30">@{entry.username}</div>
      <div className="mt-1 rounded border border-teal/25 bg-teal/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-teal">
        lvl {entry.level}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <span className={cn('font-display font-bold', place === 0 ? 'text-base text-[#F2A54A]' : 'text-[12px] text-white/70')}>
          {formatNumber(entry.score)}
        </span>
        <span className="text-[8px] text-white/25">D</span>
      </div>
      <div className="mt-1 text-[8px] text-white/25">{entry.domains_count} дом.</div>
    </div>
  );
}

function RankRow({ entry, highlight = false }: { entry: LeaderboardEntry; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition',
        highlight || entry.is_me
          ? 'border-neon-lime/30 bg-neon-lime/[0.075]'
          : 'border-white/[0.055] bg-white/[0.022]',
      )}
    >
      <div
        className={cn(
          'w-6 text-center font-display text-[12px] font-bold tabular-nums',
          entry.rank === 1
            ? 'text-[#F2A54A]'
            : entry.rank === 2
              ? 'text-white/70'
              : entry.rank === 3
                ? 'text-[#D0895A]'
                : 'text-white/25',
        )}
      >
        {entry.rank}
      </div>
      <Avatar src={entry.avatar_url} name={entry.display_name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-white/85">
            {entry.display_name}
          </span>
          {entry.is_me && (
            <span className="rounded bg-neon-lime px-1 py-0.5 text-[7px] font-extrabold uppercase text-ink-950">
              вы
            </span>
          )}
        </div>
        <div className="truncate text-[8px] text-white/25">
          @{entry.username} · LVL {entry.level} · {entry.domains_count} доменов
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-[13px] font-bold tabular-nums text-white/85">
          {formatNumber(entry.score)}
        </div>
        <div className="text-[7px] uppercase tracking-[0.1em] text-white/20">сила</div>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div>
      <div className="mb-5 grid grid-cols-3 items-end gap-2">
        <div className="h-40 animate-pulse rounded-[22px] border border-white/[0.05] bg-white/[0.025]" />
        <div className="h-48 animate-pulse rounded-[22px] border border-white/[0.05] bg-white/[0.025]" />
        <div className="h-40 animate-pulse rounded-[22px] border border-white/[0.05] bg-white/[0.025]" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="h-[58px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]"
          />
        ))}
      </div>
    </div>
  );
}
