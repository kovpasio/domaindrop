import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Eye,
  Flame,
  Hammer,
  Loader2,
  PackageOpen,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { EmptyState } from '@/components/EmptyState';
import { MythicDropOverlay } from '@/components/MythicDropOverlay';
import { PageTitle } from '@/components/PageTitle';
import { RarityBadge } from '@/components/RarityBadge';
import type {
  Domain,
  InventoryItem,
  Meta,
  UpgradePreview,
  UpgradeResult,
  UpgradeSector,
} from '@/types';
import { cn, formatNumber, hapticImpact, hapticNotify, RARITY } from '@/lib/utils';

const FALLBACK_SECTORS: UpgradeSector[] = [
  { sector: 10, multiplier: 1.1, ev: 0.11 },
  { sector: 25, multiplier: 1.25, ev: 0.3125 },
  { sector: 50, multiplier: 1.5, ev: 0.75 },
  { sector: 75, multiplier: 1.75, ev: 1.3125 },
];

const SECTOR_COLORS = ['#4D9BFF', '#B07CFF', '#F2A54A', '#43D6C5'];

function landingAngle(chance: number, success: boolean): number {
  const filled = Math.min(358, Math.max(2, chance * 3.6));
  if (success) {
    const pad = Math.min(5, filled / 4);
    return pad + Math.random() * Math.max(1, filled - pad * 2);
  }
  const free = 360 - filled;
  const pad = Math.min(5, free / 4);
  return filled + pad + Math.random() * Math.max(1, free - pad * 2);
}

export function UpgraderPage() {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin, playReveal } = useSound();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sectorIndex, setSectorIndex] = useState(2);
  const [quotedChance, setQuotedChance] = useState(() => 50 + Math.random() * 0.99);
  const [forging, setForging] = useState(false);
  const [arrowMoving, setArrowMoving] = useState(false);
  const [arrowAngle, setArrowAngle] = useState(0);
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  const [mythicDrop, setMythicDrop] = useState<Domain | null>(null);
  const closeMythicDrop = useCallback(() => setMythicDrop(null), []);

  const sectors = meta?.upgrade_sectors?.length ? meta.upgrade_sectors : FALLBACK_SECTORS;
  const sector = sectors[Math.min(sectorIndex, sectors.length - 1)];
  const chanceRange = meta?.economy.upgrade_chance_ranges?.[String(sector.sector)] ?? [
    sector.sector,
    sector.sector + 0.99,
  ];

  function newQuote(value: number) {
    return Math.round((value + Math.random() * 0.99) * 100) / 100;
  }

  async function loadInventory() {
    try {
      setItems(await api.inventory());
    } catch (error) {
      setItems([]);
      toast(error instanceof Error ? error.message : 'Не удалось загрузить инвентарь', 'error');
    }
  }

  useEffect(() => {
    void loadInventory();
    void api
      .meta()
      .then(setMeta)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItems = useMemo(
    () => (items ?? []).filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const sum = selectedItems.reduce((total, item) => total + item.domain.price, 0);
  // Use the exact domain chosen for the preview. The raw multiplier target is
  // only a fallback while the preview request is in flight.
  const target =
    preview?.target_value ?? Math.round(sum * (1 + quotedChance / 100));

  useEffect(() => {
    if (!selectedItems.length) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreview(null);
    const nextQuote = newQuote(sector.sector);
    setQuotedChance(nextQuote);
    const timer = window.setTimeout(() => {
      void api
        .upgradePreview(
          selectedItems.map((item) => item.id),
          sector.sector,
          nextQuote,
        )
        .then((next) => {
          if (!cancelled) setPreview(next);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sum, sector.sector]);

  function toggle(id: number) {
    if (forging) return;
    hapticImpact('light');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 50) {
          toast('Можно выбрать не больше 50 доменов', 'error');
          return current;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function runUpgrade() {
    if (!selectedItems.length || forging) return;
    const attemptChance = quotedChance;
    setForging(true);
    setArrowMoving(false);
    setArrowAngle(0);
    setResult(null);
    setMythicDrop(null);
    hapticImpact('medium');
    try {
      const response = await api.upgrade(
        selectedItems.map((item) => item.id),
        sector.sector,
        attemptChance,
      );
      const finalAngle = landingAngle(attemptChance, response.success);
      setArrowAngle(1440 + finalAngle);
      setArrowMoving(true);
      // The spin happens inside the tab, then the result appears in place.
      await new Promise((resolve) => window.setTimeout(resolve, 3900));
      setArrowMoving(false);
      setResult(response);
      if (response.success && response.domain?.rarity === 'mythic') {
        setMythicDrop(response.domain);
      }
      setForging(false);
      setSelectedIds(new Set());
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80);
      await loadInventory();
      hapticNotify(response.success ? 'success' : 'error');
      if (response.success) {
        if (response.domain) playReveal(response.domain.rarity);
        playCoin();
      }
      void refresh().catch(() => undefined);
    } catch (error) {
      setForging(false);
      setArrowMoving(false);
      setArrowAngle(0);
      toast(error instanceof Error ? error.message : 'Не удалось выполнить апгрейд', 'error');
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="domain forge"
        title="Апгрейдер"
        description="Соберите домены в один апгрейд. Чем выше риск — тем дороже награда, но при провале сгорает всё."
      />

      <AnimatePresence>
        {result && <ResultCard result={result} onClose={() => setResult(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {mythicDrop && (
          <MythicDropOverlay domain={mythicDrop} onClose={closeMythicDrop} />
        )}
      </AnimatePresence>

      <section className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-accent/50 via-gold/25 to-teal/40 p-px shadow-neon-lime">
        <div className="relative overflow-hidden rounded-[15px] bg-ink-800">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-accent/[0.13] to-transparent" />
          <div className="relative p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-gold">
                  domain forge
                </div>
                <div className="mt-1 font-display text-[13px] font-semibold text-paper">
                  Шанс на апгрейд
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-right">
                <div className="text-[7px] uppercase tracking-[0.12em] text-muted/60">в работе</div>
                <div className="font-display text-[12px] font-semibold text-paper">
                  {selectedItems.length} / 50
                </div>
              </div>
            </div>

            <div className="relative flex justify-center py-1">
              <ChanceWheel
                percent={quotedChance}
                chanceRange={chanceRange}
                color={SECTOR_COLORS[sectorIndex % SECTOR_COLORS.length]}
                arrowAngle={arrowAngle}
                moving={arrowMoving}
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {sectors.map((item, index) => {
                const active = index === sectorIndex;
                return (
                  <button
                    key={item.sector}
                    type="button"
                    disabled={forging}
                    onClick={() => {
                      setSectorIndex(index);
                      hapticImpact('light');
                    }}
                    className={cn(
                      'rounded-lg border px-1 py-2 text-center transition',
                      active ? '' : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.14]',
                    )}
                    style={
                      active
                        ? {
                            borderColor: `${SECTOR_COLORS[index]}80`,
                            background: `${SECTOR_COLORS[index]}1A`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="py-0.5 font-display text-[12px] font-bold"
                      style={{ color: active ? SECTOR_COLORS[index] : undefined }}
                    >
                      {item.sector}%
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.07] bg-ink-900/70 p-3">
              <ForgeStat label="Сумма" value={`${formatNumber(sum)} D`} />
              <ForgeStat label="Цель" value={`${formatNumber(target)} D`} good />
              <ForgeStat label="Шанс" value={`${quotedChance.toFixed(2)}%`} />
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-3 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.07] to-transparent p-3">
                <div className="flex items-center gap-1.5 text-[7px] font-bold uppercase tracking-[0.14em] text-accent-soft">
                  <Eye size={11} /> может выпасть
                </div>
                {preview ? (
                  preview.domain ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <RarityBadge rarity={preview.domain.rarity} />
                        <span className="truncate font-display text-[12px] font-semibold text-paper">
                          {preview.domain.name}
                          <span style={{ color: RARITY[preview.domain.rarity].color }}>
                            {preview.domain.zone}
                          </span>
                        </span>
                      </div>
                      <span className="shrink-0 font-display text-[11px] font-semibold text-gold">
                        {formatNumber(preview.domain.price)} D
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted">Новый Mythic-домен</span>
                      <span className="font-display text-[11px] font-semibold text-rarity-mythic">
                        ~{formatNumber(preview.target_value)} D
                      </span>
                    </div>
                  )
                ) : (
                  <div className="mt-2 text-[9px] text-muted/60">Считаем возможный дроп…</div>
                )}
              </div>
            )}

            <div className="mt-3 min-h-[54px]">
              {selectedItems.length ? (
                <div className="flex gap-1.5 overflow-x-auto axis-x pb-0.5">
                  {selectedItems.slice(0, 4).map((item) => (
                    <SelectedChip key={item.id} item={item} onRemove={() => toggle(item.id)} />
                  ))}
                  {selectedItems.length > 4 && (
                    <div className="flex shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[9px] text-muted">
                      +{selectedItems.length - 4}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('forge-inventory')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] py-2.5 text-[9px] text-muted transition hover:border-accent/40 hover:text-paper"
                >
                  <PackageOpen size={13} /> Выберите домены из инвентаря ниже
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!selectedItems.length || forging}
              onClick={() => void runUpgrade()}
              className={cn(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] transition active:scale-[0.99]',
                selectedItems.length
                  ? 'bg-gradient-to-r from-accent via-[#6D8CFF] to-teal text-[#08101B] shadow-neon-lime'
                  : 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-muted/50',
              )}
            >
              {forging ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={17} />}
              {forging ? 'Куём…' : 'Прокачать'}
            </button>
          </div>
        </div>
      </section>

      <div id="forge-inventory" className="mb-2.5 flex items-center justify-between">
        <div>
          <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-accent-soft">
            инвентарь
          </div>
          <div className="mt-0.5 text-[10px] text-muted">
            {items === null ? 'Загрузка…' : `${items.length} доменов`}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!items?.length || forging}
            onClick={() => {
              setSelectedIds(new Set((items ?? []).slice(0, 50).map((item) => item.id)));
              hapticImpact('light');
            }}
            className="bulk-chip"
          >
            Все
          </button>
          <button
            type="button"
            disabled={!selectedIds.size || forging}
            onClick={() => setSelectedIds(new Set())}
            className="bulk-chip"
          >
            Сбросить
          </button>
        </div>
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[104px] animate-pulse rounded-xl bg-white/[0.02]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Нет доменов для апгрейда"
          description="Сначала выиграйте домены в рулетке."
        />
      ) : (
        <div className="grid max-h-[350px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
          {items.map((item) => {
            const selected = selectedIds.has(item.id);
            const meta = RARITY[item.domain.rarity];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'relative overflow-hidden rounded-xl border p-2.5 text-left transition active:scale-[0.99]',
                  selected
                    ? 'border-accent/65 bg-accent/[0.09]'
                    : 'border-white/[0.07] bg-ink-800 hover:border-white/[0.14]',
                )}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="text-[7px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      'flex items-center justify-center rounded border',
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-white/15 text-transparent',
                    )}
                    style={{ width: 17, height: 17 }}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                </div>
                <div className="mt-2.5 truncate font-display text-[13px] font-semibold text-paper">
                  {item.domain.name}
                  <span style={{ color: meta.color }}>{item.domain.zone}</span>
                </div>
                <div className="mt-1 font-display text-[10px] font-semibold text-muted">
                  {formatNumber(item.domain.price)} D
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-rarity-legendary/20 bg-rarity-legendary/[0.05] px-3.5 py-3 text-[9px] leading-relaxed text-muted">
        <Flame size={13} className="mt-0.5 shrink-0 text-rarity-legendary" />
        При провале все выбранные домены сгорают. Mythic-домены тоже можно улучшать.
      </div>

    </div>
  );
}

function ForgeStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[7px] uppercase tracking-[0.1em] text-muted/60">{label}</div>
      <div
        className={cn(
          'mt-0.5 font-display text-[10px] font-semibold',
          good ? 'text-gold' : 'text-paper',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SelectedChip({ item, onRemove }: { item: InventoryItem; onRemove: () => void }) {
  const meta = RARITY[item.domain.rarity];
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5"
      style={{ borderColor: `${meta.color}45`, background: `${meta.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      <span className="max-w-[105px] truncate font-display text-[9px] font-semibold text-paper">
        {item.domain.name}
        <span style={{ color: meta.color }}>{item.domain.zone}</span>
      </span>
      <span className="text-[8px] text-muted">{formatNumber(item.domain.price)} D</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-muted/60 transition hover:text-paper"
        aria-label="Убрать домен"
      >
        <X size={10} />
      </button>
    </div>
  );
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function ChanceWheel({
  percent,
  chanceRange,
  color,
  arrowAngle,
  moving,
  large = false,
}: {
  percent: number;
  chanceRange: [number, number] | number[];
  color: string;
  arrowAngle: number;
  moving: boolean;
  large?: boolean;
}) {
  const size = large ? 250 : 218;
  const center = 120;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(100, Math.max(0, percent)) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-6 rounded-full blur-2xl"
        style={{ background: `${color}1F` }}
      />
      <svg viewBox="0 0 240 240" className="relative h-full w-full overflow-visible">
        <circle cx={center} cy={center} r={104} fill="none" stroke="#273A52" strokeWidth="1" opacity=".7" />
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#24364E" strokeWidth="16" />

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ filter: `drop-shadow(0 0 7px ${color}88)` }}
        />

        {Array.from({ length: 48 }).map((_, index) => {
          const angle = index * 7.5;
          const inner = polar(center, center, 68, angle);
          const outer = polar(center, center, index % 4 === 0 ? 74 : 72, angle);
          return (
            <line
              key={index}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={index % 4 === 0 ? '#7E98B8' : '#41536C'}
              strokeWidth={index % 4 === 0 ? 1.4 : 1}
              strokeLinecap="round"
              opacity={index % 4 === 0 ? 0.65 : 0.4}
            />
          );
        })}

        <circle cx={center} cy={center} r={59} fill="#0E1724" stroke="#2A3A52" strokeWidth="1" />
        <circle
          cx={center}
          cy={center}
          r={50}
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity=".38"
        />

        <g
          style={{
            transform: `rotate(${arrowAngle}deg)`,
            transformOrigin: '120px 120px',
            willChange: moving ? 'transform' : 'auto',
            transition: moving
              ? 'transform 3.6s cubic-bezier(.42,.02,.12,1)'
              : 'none',
          }}
        >
          <path d="M114 2 L126 2 L120 16 Z" fill={color} />
          <line
            x1="120"
            y1="16"
            x2="120"
            y2="25"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[7px] font-bold uppercase tracking-[0.26em] text-muted/60">
          chance
        </div>
        <div className="mt-1 font-display text-[30px] font-bold leading-none tracking-tight text-paper">
          {moving ? '···' : `${percent.toFixed(2)}%`}
        </div>
        <div className="mt-2 text-[7px] text-muted/60">
          {moving
            ? 'стрелка решает'
            : `${chanceRange[0].toFixed(2)}–${chanceRange[1].toFixed(2)}%`}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, onClose }: { result: UpgradeResult; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border p-4',
        result.success
          ? 'border-teal/35 bg-gradient-to-br from-teal/[0.12] via-ink-800 to-accent/[0.08]'
          : 'border-rarity-mythic/30 bg-gradient-to-br from-rarity-mythic/[0.1] via-ink-800 to-ink-800',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[10px] font-semibold',
            result.success ? 'text-teal' : 'text-rarity-mythic',
          )}
        >
          {result.success ? <Sparkles size={12} /> : <Flame size={12} />}
          {result.success ? 'Апгрейд удался' : 'Домены сгорели'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted/60 transition hover:text-paper"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
      {result.success && result.domain ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <RarityBadge rarity={result.domain.rarity} />
            <span className="text-[8px] text-muted">шанс {result.chance.toFixed(2)}%</span>
          </div>
          <div className="mt-2 font-display text-[26px] font-semibold tracking-tight text-paper">
            {result.domain.name}
            <span style={{ color: RARITY[result.domain.rarity].color }}>
              {result.domain.zone}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-muted">
            Цена {formatNumber(result.domain.price)} D · потрачено {formatNumber(result.spent_value)} D
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 font-display text-xl font-semibold text-paper">
            Не в этот раз
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-muted">
            Шанс был {result.chance.toFixed(2)}%. Сумма {formatNumber(result.spent_value)} D
            списана из коллекции.
          </div>
        </>
      )}
    </motion.div>
  );
}
