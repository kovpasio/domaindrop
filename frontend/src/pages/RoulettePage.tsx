import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Dices,
  Loader2,
  Package,
  RotateCw,
  Settings2,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { MythicDropOverlay } from '@/components/MythicDropOverlay';
import { RarityBadge } from '@/components/RarityBadge';
import { SectionTitle } from '@/components/SectionTitle';
import type { Domain, Meta, RollType, SpinResult } from '@/types';
import {
  cn,
  formatCompact,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
  RARITY_ORDER,
  timeAgo,
} from '@/lib/utils';

const ITEM_WIDTH = 118;
const ITEM_GAP = 9;
const ITEM_STEP = ITEM_WIDTH + ITEM_GAP;
const TARGET_INDEX = 38;
const RIBBON_LENGTH = 48;
const SPIN_DURATION = 4.2;

function fillRibbon(source: Domain[], count = RIBBON_LENGTH): Domain[] {
  if (!source.length) return [];
  return Array.from({ length: count }, (_, index) => source[index % source.length]);
}

export function RoulettePage() {
  const { me, refresh, applyBalance, incrementBalance } = useAuth();
  const { toast } = useToast();
  const { playTick, playReveal, playCoin } = useSound();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [activeType, setActiveType] = useState<RollType>('normal');
  const [feed, setFeed] = useState<Domain[]>([]);
  const [ribbon, setRibbon] = useState<Domain[]>([]);
  const [ribbonId, setRibbonId] = useState(0);
  const [animateTarget, setAnimateTarget] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [quickSoldPrice, setQuickSoldPrice] = useState<number | null>(null);
  const [selling, setSelling] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [mythicDrop, setMythicDrop] = useState<Domain | null>(null);
  const closeMythicDrop = useCallback(() => setMythicDrop(null), []);
  const [revealed, setRevealed] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [triple, setTriple] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const tickTimers = useRef<number[]>([]);
  const finishTimer = useRef<number | null>(null);
  const lock = useRef(false);

  const activeRoll = meta?.roll_types.find((item) => item.key === activeType) ?? null;

  const clearTicks = useCallback(() => {
    tickTimers.current.forEach((timer) => window.clearTimeout(timer));
    tickTimers.current = [];
  }, []);

  const clearFinishTimer = useCallback(() => {
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void api
      .meta()
      .then((data) => {
        if (mounted) setMeta(data);
      })
      .catch(() => {
        if (mounted) toast('Не удалось загрузить конфигурацию рулетки', 'error');
      });
    return () => {
      mounted = false;
      clearTicks();
      clearFinishTimer();
    };
  }, [clearFinishTimer, clearTicks, toast]);

  const loadFeed = useCallback(
    async (rollType: RollType) => {
      setLoadingFeed(true);
      try {
        const domains = await api.feed(rollType, 60);
        setFeed(domains);
        setRibbon(fillRibbon(domains));
        setAnimateTarget(0);
        setRibbonId((value) => value + 1);
      } catch {
        toast('Не удалось загрузить ленту доменов', 'error');
      } finally {
        setLoadingFeed(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!meta) return;
    setResult(null);
    setRevealed(false);
    void loadFeed(activeType);
  }, [activeType, meta, loadFeed]);

  const scheduleTicks = useCallback(() => {
    clearTicks();
    let elapsed = 0;
    let gap = 70;
    while (elapsed < SPIN_DURATION * 1000 - 170) {
      tickTimers.current.push(window.setTimeout(() => playTick(), elapsed));
      elapsed += gap;
      gap = Math.min(360, gap * 1.08);
    }
  }, [clearTicks, playTick]);

  const finishSpin = useCallback(
    (spinResult: SpinResult) => {
      if (!lock.current) return;
      lock.current = false;
      clearFinishTimer();
      setSpinning(false);
      setRevealed(true);
      if (spinResult.rarity === 'mythic') {
        setMythicDrop(spinResult.domain);
      }
      applyBalance(spinResult.balance);
      playReveal(spinResult.rarity);
      hapticNotify(
        spinResult.rarity === 'mythic' || spinResult.rarity === 'legendary'
          ? 'success'
          : 'warning',
      );
      if (spinResult.auto_sold) {
        toast(
          `Автопродано: ${spinResult.domain.full_name} +${formatNumber(spinResult.auto_sold_price ?? spinResult.price)} D`,
          'success',
        );
      }
      void refresh().catch(() => undefined);
    },
    [applyBalance, clearFinishTimer, playReveal, refresh, toast],
  );

  async function keepAutoSold() {
    if (!result || keeping || !result.auto_sold) return;
    setKeeping(true);
    hapticImpact('light');
    try {
      const kept = await api.keepSpin(result.id);
      applyBalance(kept.balance);
      setResult((current) =>
        current
          ? {
              ...current,
              auto_sold: false,
              auto_sold_price: null,
              inventory_id: kept.inventory_id,
            }
          : current,
      );
      setQuickSoldPrice(null);
      hapticNotify('success');
      toast('Домен оставлен в инвентаре', 'success');
      void refresh().catch(() => undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось оставить домен', 'error');
    } finally {
      setKeeping(false);
    }
  }

  async function quickSellResult() {
    if (!result || selling || !result.inventory_id || result.auto_sold) return;
    setSelling(true);
    hapticImpact('light');
    try {
      const sold = await api.sell(result.inventory_id);
      applyBalance(sold.balance);
      setQuickSoldPrice(sold.sold_price);
      playCoin();
      hapticNotify('success');
      toast(`Продано: +${formatNumber(sold.sold_price)} D`, 'success');
      void refresh().catch(() => undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось продать домен', 'error');
    } finally {
      setSelling(false);
    }
  }

  async function spin() {
    if (!activeRoll || spinning || lock.current) return;
    const times = triple ? 3 : 1;
    const cost = activeRoll.cost * times;
    if ((me?.user.balance ?? 0) < cost) {
      toast(`Недостаточно монет. Нужно ${formatNumber(cost)} D`, 'error');
      return;
    }

    lock.current = true;
    incrementBalance(-cost);
    setSpinning(true);
    setRevealed(false);
    setResult(null);
    setQuickSoldPrice(null);
    setSelling(false);
    setKeeping(false);
    setMythicDrop(null);
    hapticImpact('light');

    try {
      const [response, freshFeed] = await Promise.all([
        api.spin(activeType, times),
        api.feed(activeType, 60).catch(() => [] as Domain[]),
      ]);

      if (freshFeed.length) {
        setFeed(freshFeed);
      }
      const pool = (freshFeed.length ? freshFeed : feed.length ? feed : [response.domain]).filter(
        (domain) => domain.id !== response.domain.id,
      );
      const nextRibbon = fillRibbon(pool.length ? pool : [response.domain]);
      nextRibbon[TARGET_INDEX] = response.domain;

      const width = viewportRef.current?.offsetWidth ?? 360;
      const target = width / 2 - (TARGET_INDEX * ITEM_STEP + ITEM_WIDTH / 2);

      setResult(response);
      setRibbon(nextRibbon);
      setAnimateTarget(target);
      setRibbonId((value) => value + 1);
      scheduleTicks();
      clearFinishTimer();
      finishTimer.current = window.setTimeout(
        () => finishSpin(response),
        SPIN_DURATION * 1000 + 140,
      );
    } catch (error) {
      lock.current = false;
      incrementBalance(cost);
      setSpinning(false);
      clearFinishTimer();
      toast(error instanceof Error ? error.message : 'Спин не удался', 'error');
    }
  }

  if (!me) return null;
  const balance = me.user.balance;
  const activeCost = (activeRoll?.cost ?? 0) * (triple ? 3 : 1);
  const canAfford = activeRoll ? balance >= activeCost : false;
  const disabled = !activeRoll || spinning || loadingFeed || !feed.length || !canAfford;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted/60">
            domain roulette
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-none tracking-tight text-paper">
            Рулетка
          </h1>
          <p className="mt-1.5 text-[11px] text-muted">
            {formatNumber(meta?.total_domains ?? 0)} доменов в пуле
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-ink-800 px-3 py-2 text-right">
          <div className="text-[8px] uppercase tracking-[0.12em] text-muted/60">Спинов</div>
          <div className="mt-0.5 font-display text-sm font-semibold text-paper">
            {formatNumber(me.user.total_spins)}
          </div>
          <div className="mt-1 text-[8px] font-semibold text-teal">
            удача +{me.progress.total_luck.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {(meta?.roll_types ?? []).map((roll) => {
          const active = roll.key === activeType;
          return (
            <button
              key={roll.key}
              type="button"
              disabled={spinning}
              onClick={() => {
                if (spinning) return;
                hapticImpact('light');
                setActiveType(roll.key);
              }}
              className={cn(
                'min-w-0 rounded-xl border px-2 py-2.5 text-left transition',
                active
                  ? 'border-accent/60 bg-gradient-to-b from-accent/20 to-accent/[0.06] shadow-neon-lime'
                  : 'border-white/[0.07] bg-ink-800/70 hover:border-white/[0.14]',
                spinning && 'opacity-60',
              )}
            >
              <div
                className={cn(
                  'truncate text-[9px] font-semibold',
                  active ? 'text-paper' : 'text-muted',
                )}
              >
                {roll.title}
              </div>
              <div className="mt-1 font-display text-[10px] font-semibold text-accent-soft">
                {formatNumber(roll.cost)} D
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-800 p-2 shadow-soft">
        <div className="flex items-center justify-between px-1.5 pb-2 pt-0.5">
          <div className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted/60">
            <Sparkles size={10} />
            пул {activeRoll?.short_title ?? '—'}
          </div>
          <div className="text-[8px] text-muted/50">
            {activeRoll?.rarities.map((item) => RARITY[item].label).join(' · ')}
          </div>
        </div>

        <div
          ref={viewportRef}
          className="roulette-fade relative h-[156px] overflow-hidden rounded-xl border border-white/[0.05] bg-ink-900"
        >
          <div className="absolute inset-x-0 top-0 z-10 flex h-3 items-end justify-between px-3 opacity-20">
            {Array.from({ length: 26 }).map((_, index) => (
              <span key={index} className={cn('w-px bg-paper', index % 4 === 0 ? 'h-1.5' : 'h-1')} />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex h-3 items-start justify-between px-3 opacity-20">
            {Array.from({ length: 26 }).map((_, index) => (
              <span key={index} className={cn('w-px bg-paper', index % 4 === 0 ? 'h-1.5' : 'h-1')} />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center">
            <motion.div
              key={ribbonId}
              initial={{ x: 0 }}
              animate={{ x: animateTarget }}
              transition={{ duration: SPIN_DURATION, ease: [0.12, 0.72, 0.12, 1] }}
              className="flex w-max gap-[9px] will-change-transform"
            >
              {ribbon.map((domain, index) => (
                <RibbonCard
                  key={`${ribbonId}-${index}-${domain.id}`}
                  domain={domain}
                  highlighted={revealed && index === TARGET_INDEX}
                />
              ))}
            </motion.div>
          </div>

          <div className="roulette-vignette pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
            <div className="h-full w-px bg-accent-soft/80" />
            <div className="absolute -top-0.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[6px] border-x-transparent border-t-accent-soft" />
            <div className="absolute -bottom-0.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[4px] border-b-[6px] border-x-transparent border-b-accent-soft" />
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        {RARITY_ORDER.map((rarity) => (
          <div
            key={rarity}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-white/[0.05] bg-ink-800/60 py-2"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RARITY[rarity].color }} />
            <span className="text-[7px] font-semibold uppercase tracking-[0.04em]" style={{ color: RARITY[rarity].color }}>
              {RARITY[rarity].label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-800/60 px-3.5 py-2.5">
        <div>
          <div className="text-[10px] font-semibold text-paper">×3 прокрутка</div>
          <div className="mt-0.5 text-[8px] text-muted">
            Три спины за одну цену ×3. В результат идёт лучший домен.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={triple}
          disabled={spinning}
          onClick={() => {
            hapticImpact('light');
            setTriple((value) => !value);
          }}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full border transition',
            triple
              ? 'border-accent/50 bg-accent/80'
              : 'border-white/[0.1] bg-white/[0.06]',
            spinning && 'opacity-50',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all',
              triple ? 'left-[22px]' : 'left-0.5',
            )}
            style={{ width: 18, height: 18 }}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void spin()}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[14px] font-semibold transition active:scale-[0.99]',
          disabled
            ? 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-muted/50'
            : 'bg-accent text-white hover:bg-accent-soft',
        )}
      >
        {spinning ? <RotateCw size={17} className="animate-spin" /> : <Dices size={18} />}
        {spinning
          ? 'Крутим…'
          : loadingFeed
            ? 'Загрузка пула…'
            : `Крутить${triple ? ' ×3' : ''} · ${formatNumber(activeCost)} D`}
      </button>

      {!canAfford && activeRoll && (
        <div className="flex items-center justify-between rounded-xl border border-rarity-legendary/20 bg-rarity-legendary/[0.05] px-3.5 py-2.5 text-[10px] text-rarity-legendary">
          <span>Недостаточно монет для этого типа</span>
          <Link to="/inventory" className="flex items-center gap-1 font-medium">
            Продать домены <ArrowRight size={12} />
          </Link>
        </div>
      )}

      <AnimatePresence>
        {revealed && result && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden rounded-2xl border bg-ink-800 p-4"
            style={{ borderColor: `${RARITY[result.rarity].color}55` }}
          >
            <div className="flex items-center justify-between">
              <span className="label">Результат</span>
              {result.auto_sold ? (
                <span className="flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[8px] font-semibold text-accent-soft">
                  <CheckCircle2 size={10} /> автопродано
                </span>
              ) : quickSoldPrice !== null ? (
                <span className="flex items-center gap-1 rounded bg-gold/10 px-1.5 py-0.5 text-[8px] font-semibold text-gold">
                  <Coins size={10} /> продано
                </span>
              ) : (
                <span className="text-[8px] text-muted/60">
                  {result.times > 1 ? `×${result.times} · ` : ''}#{result.id}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <RarityBadge rarity={result.rarity} />
                <div className="mt-2 flex items-baseline gap-0.5 font-display text-[28px] font-semibold leading-none tracking-tight text-paper">
                  <span className="truncate">{result.domain.name}</span>
                  <span style={{ color: RARITY[result.rarity].color }}>{result.domain.zone}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[8px] uppercase tracking-[0.1em] text-muted/60">
                  {result.auto_sold || quickSoldPrice !== null ? 'получено' : 'цена'}
                </div>
                <div className="font-display text-lg font-semibold text-paper">
                  {formatNumber(
                    result.auto_sold
                      ? (result.auto_sold_price ?? result.price)
                      : (quickSoldPrice ?? result.price),
                  )}{' '}
                  D
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[9px] text-muted">
              <span>{activeRoll?.title}</span>
              <span>·</span>
              <span>{timeAgo(result.created_at)}</span>
              <span>·</span>
              <span
                className={
                  result.auto_sold || quickSoldPrice !== null ? 'text-accent-soft' : ''
                }
              >
                {result.auto_sold
                  ? 'баланс пополнен'
                  : quickSoldPrice !== null
                    ? 'продано, баланс пополнен'
                    : 'добавлен в инвентарь'}
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {result.auto_sold ? (
                <button
                  type="button"
                  onClick={() => void keepAutoSold()}
                  disabled={keeping}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-teal/30 bg-teal/10 py-2.5 text-[10px] font-semibold text-teal transition hover:bg-teal/15 disabled:opacity-50"
                >
                  {keeping ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                  {keeping ? 'Оставляем…' : 'Оставить'}
                </button>
              ) : quickSoldPrice !== null ? (
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gold/25 bg-gold/10 py-2.5 text-[10px] font-semibold text-gold opacity-80"
                >
                  <CheckCircle2 size={13} /> Продано
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void quickSellResult()}
                  disabled={selling || !result.inventory_id}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 py-2.5 text-[10px] font-semibold text-gold transition hover:bg-gold/15 disabled:opacity-50"
                >
                  {selling ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
                  {selling ? 'Продаём…' : `Продать за ${formatNumber(result.price)} D`}
                </button>
              )}
              <button
                type="button"
                onClick={() => void spin()}
                disabled={spinning || !canAfford}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-accent/90 py-2.5 text-[10px] font-semibold text-white transition hover:bg-accent disabled:opacity-50"
              >
                <RotateCw size={13} /> Ещё спин
              </button>
            </div>

            <Link
              to="/inventory"
              className="mt-2.5 flex items-center justify-center gap-1 text-[9px] text-muted transition hover:text-paper"
            >
              <Package size={12} /> Открыть инвентарь <ArrowRight size={11} />
            </Link>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mythicDrop && (
          <MythicDropOverlay domain={mythicDrop} onClose={closeMythicDrop} />
        )}
      </AnimatePresence>

      {activeRoll && (
        <div className="rounded-xl border border-white/[0.05] bg-ink-800/50 px-3.5 py-3">
          <div className="flex items-center justify-between text-[9px] text-muted">
            <span>Стоимость спина{triple ? ' ×3' : ''}</span>
            <span className="font-display text-[11px] font-semibold text-paper">
              {formatNumber(activeCost)} D
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted">
            <span>Минимальная цена домена</span>
            <span className="text-paper/80">{formatNumber(activeRoll.min_price)} D</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted">
            <span>Ваш баланс</span>
            <span className="text-paper/80">{formatNumber(balance)} D</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-ink-800/60 p-3 text-[10px] text-muted transition hover:text-paper"
        >
          <Settings2 size={14} className="text-accent-soft" />
          Настроить автопродажу
        </Link>
        <Link
          to="/upgrader"
          className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-ink-800/60 p-3 text-[10px] text-muted transition hover:text-paper"
        >
          <Sparkles size={14} className="text-rarity-epic" />
          Апгрейдер доменов
        </Link>
      </div>

      <SectionTitle>Диапазоны редкостей</SectionTitle>
      <div className="space-y-1">
        {RARITY_ORDER.map((rarity) => (
          <div
            key={rarity}
            className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-ink-800/40 px-3 py-2"
          >
            <span className="text-[9px] font-medium" style={{ color: RARITY[rarity].color }}>
              {RARITY[rarity].label}
            </span>
            <span className="text-[9px] text-muted">
              {rarity === 'common' && '40 — 99 D'}
              {rarity === 'rare' && '100 — 999 D'}
              {rarity === 'epic' && '1 000 — 4 999 D'}
              {rarity === 'legendary' && '5 000 — 24 999 D'}
              {rarity === 'mythic' && '25 000+ D'}
            </span>
          </div>
        ))}
      </div>

      <p className="rounded-xl border border-white/[0.04] bg-ink-800/40 px-3.5 py-3 text-[8px] leading-relaxed text-muted/70">
        Продажа домена зачисляет ровно его цену — без скрытых комиссий и пересчёта.
      </p>
    </div>
  );
}

function RibbonCard({ domain, highlighted }: { domain: Domain; highlighted: boolean }) {
  const meta = RARITY[domain.rarity];
  return (
    <div
      className={cn(
        'relative flex h-[132px] shrink-0 flex-col justify-between overflow-hidden rounded-xl border p-2.5',
      )}
      style={{
        width: ITEM_WIDTH,
        borderColor: highlighted ? meta.color : `${meta.color}40`,
        background: `linear-gradient(155deg, ${meta.color}24 0%, #182334 54%, #141D2B 100%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-semibold uppercase tracking-[0.1em]" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="text-[10px]" style={{ color: meta.color }}>
          {meta.icon}
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-[14px] font-semibold leading-tight text-paper">
          {domain.name}
        </div>
        <div className="mt-0.5 text-[10px] font-medium" style={{ color: meta.color }}>
          {domain.zone}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
        <span className="text-[7px] uppercase tracking-[0.08em] text-muted/50">цена</span>
        <span className="font-display text-[10px] font-semibold text-paper/80">
          {formatCompact(domain.price)} D
        </span>
      </div>
    </div>
  );
}
