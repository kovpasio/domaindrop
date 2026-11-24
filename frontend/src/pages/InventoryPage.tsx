import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  CircleSlash2,
  Filter,
  KeyRound,
  PackageOpen,
  Palette,
  Sparkles,
  Tag,
  Zap,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { RarityBadge } from '@/components/RarityBadge';
import type { Booster, InventoryItem, ProfileFrame, Rarity, ThemeItem, Zone } from '@/types';
import { applyTheme } from '@/lib/themes';
import {
  cn,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
  RARITY_ORDER,
  ZONE_META,
} from '@/lib/utils';

type ZoneFilter = 'all' | Zone;
type RarityFilter = 'all' | Rarity;
type InventoryTab = 'domains' | 'cosmetics' | 'boosters';

export function InventoryPage() {
  const { applyBalance, refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin } = useSound();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [tab, setTab] = useState<InventoryTab>('domains');
  const [zone, setZone] = useState<ZoneFilter>('all');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sellOne, setSellOne] = useState<InventoryItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    void api
      .inventory()
      .then((data) => {
        if (mounted) setItems(data);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setItems([]);
          toast(error instanceof Error ? error.message : 'Не удалось загрузить инвентарь', 'error');
        }
      });
    return () => {
      mounted = false;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items
      .filter((item) => (zone === 'all' ? true : item.domain.zone === zone))
      .filter((item) => (rarity === 'all' ? true : item.domain.rarity === rarity))
      .sort((a, b) => b.domain.price - a.domain.price);
  }, [items, zone, rarity]);

  const totalValue = useMemo(
    () => (items ?? []).reduce((sum, item) => sum + item.domain.price, 0),
    [items],
  );
  const selectedItems = useMemo(
    () => (items ?? []).filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const selectedValue = selectedItems.reduce((sum, item) => sum + item.domain.price, 0);

  function toggle(id: number) {
    hapticImpact('light');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((item) => item.id)));
    hapticImpact('light');
  }

  function selectCommon() {
    setSelectedIds(
      new Set(
        filtered
          .filter((item) => item.domain.rarity === 'common')
          .map((item) => item.id),
      ),
    );
    hapticImpact('light');
  }

  function selectCheap() {
    setSelectedIds(
      new Set(
        filtered
          .filter((item) => item.domain.price <= 100)
          .map((item) => item.id),
      ),
    );
    hapticImpact('light');
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function confirmBulk() {
    if (!selectedItems.length || selling) return;
    setSelling(true);
    hapticImpact('medium');
    try {
      const result = await api.sellBulk(selectedItems.map((item) => item.id));
      setItems((current) =>
        current ? current.filter((item) => !result.ids.includes(item.id)) : current,
      );
      setSelectedIds(new Set());
      setBulkOpen(false);
      applyBalance(result.balance);
      playCoin();
      hapticNotify('success');
      toast(`Продано ${result.sold} доменов · +${formatNumber(result.earned)} D`, 'success');
      void refresh().catch(() => undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось продать домены', 'error');
    } finally {
      setSelling(false);
    }
  }

  async function confirmSingle() {
    if (!sellOne || selling) return;
    setSelling(true);
    hapticImpact('light');
    try {
      const result = await api.sell(sellOne.id);
      setItems((current) =>
        current ? current.filter((item) => item.id !== sellOne.id) : current,
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(sellOne.id);
        return next;
      });
      applyBalance(result.balance);
      playCoin();
      hapticNotify('success');
      toast(`Домен продан за ${formatNumber(result.sold_price)} D`, 'success');
      setSellOne(null);
      void refresh().catch(() => undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось продать домен', 'error');
    } finally {
      setSelling(false);
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="collection"
        title="Инвентарь"
        description="Домены, косметика и активные бустеры."
        action={
          <Link
            to="/roulette"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-soft transition active:scale-95"
            aria-label="К рулетке"
          >
            <Sparkles size={16} />
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-ink-800 p-1">
        {[
          { key: 'domains', label: 'Домены', icon: PackageOpen },
          { key: 'cosmetics', label: 'Косметика', icon: Palette },
          { key: 'boosters', label: 'Бустеры', icon: Zap },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key as InventoryTab);
              hapticImpact('light');
            }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg py-2 text-[8px] font-semibold transition',
              tab === key ? 'bg-accent/15 text-accent-soft' : 'text-muted/55',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'cosmetics' ? (
        <CosmeticsPanel />
      ) : tab === 'boosters' ? (
        <BoostersPanel />
      ) : (
        <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="relative col-span-2 overflow-hidden rounded-xl border border-white/[0.06] bg-ink-800 p-3.5">
          <div className="label mb-1.5">Стоимость коллекции</div>
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-accent-soft" />
            <span className="font-display text-xl font-semibold tracking-tight text-paper">
              {formatNumber(totalValue)}
            </span>
            <span className="text-[9px] font-semibold text-muted">D</span>
          </div>
          <div className="mt-1 text-[8px] text-muted/60">полная сумма при продаже</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-ink-800 p-3.5">
          <div className="label mb-1.5">Домены</div>
          <div className="font-display text-xl font-semibold text-paper">
            {items?.length ?? '—'}
          </div>
          <div className="mt-0.5 text-[8px] text-muted/60">в коллекции</div>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto axis-x pb-0.5">
          <div className="mr-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted/50">
            <Filter size={10} /> зона
          </div>
          {(['all', '.ru', '.com', '.io', '.xyz'] as ZoneFilter[]).map((value) => (
            <FilterChip
              key={value}
              active={zone === value}
              onClick={() => {
                setZone(value);
                hapticImpact('light');
              }}
              label={value === 'all' ? 'Все' : value}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto axis-x pb-0.5">
          <div className="mr-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted/50">
            <Tag size={10} /> редкость
          </div>
          <FilterChip
            active={rarity === 'all'}
            onClick={() => {
              setRarity('all');
              hapticImpact('light');
            }}
            label="Все"
          />
          {RARITY_ORDER.map((value) => (
            <FilterChip
              key={value}
              active={rarity === value}
              onClick={() => {
                setRarity(value);
                hapticImpact('light');
              }}
              label={RARITY[value].label}
              color={RARITY[value].color}
            />
          ))}
        </div>
      </div>

      {items && items.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted/50">
            Выбрать
          </span>
          <button type="button" onClick={selectAll} className="bulk-chip">
            Все ({filtered.length})
          </button>
          <button type="button" onClick={selectCommon} className="bulk-chip">
            Все Common
          </button>
          <button type="button" onClick={selectCheap} className="bulk-chip">
            До 100 D
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="bulk-chip flex items-center gap-1"
          >
            <X size={9} /> Сбросить
          </button>
        </div>
      )}

      {items === null ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={items.length === 0 ? PackageOpen : CircleSlash2}
          title={items.length === 0 ? 'Коллекция пуста' : 'Ничего не найдено'}
          description={
            items.length === 0
              ? 'Крутите рулетку — каждый дроп попадёт сюда.'
              : 'Попробуйте изменить фильтры.'
          }
          action={
            items.length === 0 ? (
              <Link
                to="/roulette"
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[10px] font-semibold text-accent-contrast"
              >
                Крутить <ArrowRight size={12} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setZone('all');
                  setRarity('all');
                }}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[10px] font-medium text-muted"
              >
                Сбросить фильтры
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-2.5 flex items-center justify-between text-[8px] text-muted/60">
            <span className="font-semibold uppercase tracking-[0.12em]">
              {filtered.length} {filtered.length === 1 ? 'домен' : 'доменов'}
            </span>
            <span>по цене ↓</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                >
                  <InventoryCard
                    item={item}
                    selected={selectedIds.has(item.id)}
                    onToggle={() => toggle(item.id)}
                    onSell={() => setSellOne(item)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {selectedItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto w-full max-w-md px-4">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-accent/40 bg-[#252d3a] px-4 py-3 shadow-card active:scale-[0.99]"
          >
            <span className="text-[11px] font-semibold text-paper">
              Продать выбранные ({selectedItems.length})
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-soft">
              +{formatNumber(selectedValue)} D <ArrowRight size={13} />
            </span>
          </button>
        </div>
      )}

      <BottomSheet open={Boolean(sellOne)} onClose={() => setSellOne(null)} title="Продать домен?">
        {sellOne && (
          <div>
            <div
              className="relative overflow-hidden rounded-xl border p-5 text-center"
              style={{
                borderColor: `${RARITY[sellOne.domain.rarity].color}45`,
                background: `${RARITY[sellOne.domain.rarity].color}12`,
              }}
            >
              <RarityBadge rarity={sellOne.domain.rarity} className="mb-3" />
              <div className="font-display text-[26px] font-semibold tracking-tight text-paper">
                {sellOne.domain.name}
                <span style={{ color: RARITY[sellOne.domain.rarity].color }}>
                  {sellOne.domain.zone}
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-muted">
                {ZONE_META[sellOne.domain.zone].label} · {RARITY[sellOne.domain.rarity].label}
              </div>
            </div>

            <div className="my-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-900 px-3.5 py-3">
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <BadgeDollarSign size={14} className="text-accent-soft" />
                Вы получите
              </div>
              <div className="font-display text-lg font-semibold text-paper">
                +{formatNumber(sellOne.domain.price)} D
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSellOne(null)}
                className="rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-[10px] font-medium text-muted"
              >
                Оставить
              </button>
              <button
                type="button"
                disabled={selling}
                onClick={() => void confirmSingle()}
                className="rounded-lg bg-accent py-2.5 text-[10px] font-semibold text-accent-contrast disabled:opacity-60"
              >
                {selling ? 'Продаём…' : 'Продать'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title="Массовая продажа">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-ink-900 p-4">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Выбрано доменов</span>
              <span className="font-display text-base font-semibold text-paper">
                {selectedItems.length}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
              <span>Сумма к зачислению</span>
              <span className="font-display text-lg font-semibold text-accent-soft">
                +{formatNumber(selectedValue)} D
              </span>
            </div>
          </div>
          <p className="text-[9px] leading-relaxed text-muted/70">
            Все выбранные домены исчезнут из коллекции и перестанут учитываться в рейтинге.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-[10px] font-medium text-muted"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={selling}
              onClick={() => void confirmBulk()}
              className="rounded-lg bg-accent py-2.5 text-[10px] font-semibold text-accent-contrast disabled:opacity-60"
            >
              {selling ? 'Продаём…' : `Продать (${selectedItems.length})`}
            </button>
          </div>
        </div>
      </BottomSheet>
        </>
      )}
    </div>
  );
}

function CosmeticsPanel() {
  const { me, refresh, applyBalance } = useAuth();
  const { toast } = useToast();
  const [kind, setKind] = useState<'frames' | 'themes'>('frames');
  const [frames, setFrames] = useState<ProfileFrame[] | null>(null);
  const [themes, setThemes] = useState<ThemeItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.frames(), api.themes()])
      .then(([frameData, themeData]) => {
        setFrames(frameData.frames);
        setThemes(themeData.themes);
      })
      .catch(() => {
        setFrames([]);
        setThemes([]);
      });
  }, []);

  const sortedFrames = [...(frames ?? [])].sort(
    (a, b) => Number(b.owned) - Number(a.owned) || a.title.localeCompare(b.title),
  );
  const sortedThemes = [...(themes ?? [])].sort(
    (a, b) => Number(b.owned) - Number(a.owned) || a.title.localeCompare(b.title),
  );
  const current = kind === 'frames' ? sortedFrames : sortedThemes;
  const ownedCount = current.filter((item) => item.owned).length;

  async function equipFrame(key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const data = await api.equipFrame(key);
      setFrames(data.frames);
      hapticImpact('light');
      toast('Рамка установлена', 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось надеть рамку', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function buyFrame(key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const data = await api.buyFrame(key);
      setFrames(data.frames);
      applyBalance(data.balance);
      hapticImpact('light');
      toast('Рамка куплена', 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось купить рамку', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function equipTheme(key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const data = await api.equipTheme(key);
      setThemes(data.themes);
      applyTheme(key, null);
      hapticImpact('light');
      toast('Тема применена', 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось применить тему', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-rarity-epic/20 bg-rarity-epic/[0.06] px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold text-paper">Косметика</div>
          <div className="mt-0.5 text-[8px] text-muted/60">
            {kind === 'frames' ? 'Рамки профиля' : 'Темы приложения'}
          </div>
        </div>
        <div className="font-display text-2xl font-semibold text-rarity-epic">
          {ownedCount}
          <span className="ml-0.5 text-[10px] text-muted/40">/ {current.length}</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-ink-800 p-1">
        {[
          { key: 'frames', label: 'Рамки' },
          { key: 'themes', label: 'Темы' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setKind(item.key as 'frames' | 'themes');
              hapticImpact('light');
            }}
            className={cn(
              'rounded-lg py-2 text-[9px] font-semibold transition',
              kind === item.key ? 'bg-accent/15 text-accent-soft' : 'text-muted/55',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {(kind === 'frames' ? frames : themes) === null ? (
          <div className="h-24 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
        ) : kind === 'frames' ? (
          sortedFrames.map((frame) => (
            <div
              key={frame.key}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                frame.owned
                  ? 'border-white/[0.07] bg-ink-800'
                  : 'border-white/[0.04] bg-ink-800/45 opacity-60',
              )}
            >
              <Avatar name={me?.user.display_name ?? 'Domain Drop'} size={42} frame={frame.key} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-paper">{frame.title}</span>
                  {!frame.owned && <span className="text-[8px] text-muted/40">🔒</span>}
                </div>
                <div className="mt-0.5 truncate text-[8px] text-muted/55">{frame.description}</div>
              </div>
              {frame.owned && !frame.equipped ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void equipFrame(frame.key)}
                  className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-[7px] font-semibold text-accent-soft"
                >
                  {busy === frame.key ? '…' : 'Надеть'}
                </button>
              ) : !frame.owned && frame.price !== null && frame.price > 0 ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void buyFrame(frame.key)}
                  className="rounded-lg border border-gold/25 bg-gold/10 px-2 py-1.5 text-[7px] font-semibold text-gold"
                >
                  {busy === frame.key ? '…' : `${formatNumber(frame.price)} D`}
                </button>
              ) : (
                <span
                  className={cn(
                    'rounded-md border px-1.5 py-1 text-[7px] font-semibold',
                    frame.equipped
                      ? 'border-teal/25 bg-teal/10 text-teal'
                      : 'border-gold/15 text-gold/60',
                  )}
                >
                  {frame.equipped
                    ? 'на аватаре'
                    : frame.achievement
                      ? 'за достижение'
                      : 'базовая'}
                </span>
              )}
            </div>
          ))
        ) : (
          sortedThemes.map((theme) => (
            <div
              key={theme.key}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                theme.owned
                  ? 'border-white/[0.07] bg-ink-800'
                  : 'border-white/[0.04] bg-ink-800/45 opacity-60',
              )}
            >
              <div
                className="h-10 w-10 shrink-0 rounded-full border border-white/20"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-paper">{theme.title}</span>
                  {!theme.owned && <span className="text-[8px] text-muted/40">🔒</span>}
                </div>
                <div className="mt-0.5 truncate text-[8px] text-muted/55">{theme.description}</div>
              </div>
              {theme.owned && !theme.equipped ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void equipTheme(theme.key)}
                  className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-[7px] font-semibold text-accent-soft"
                >
                  {busy === theme.key ? '…' : 'Применить'}
                </button>
              ) : (
                <span
                  className={cn(
                    'rounded-md border px-1.5 py-1 text-[7px] font-semibold',
                    theme.equipped
                      ? 'border-teal/25 bg-teal/10 text-teal'
                      : 'border-gold/15 text-gold/60',
                  )}
                >
                  {theme.equipped ? 'выбрана' : 'из кейсов'}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BoostersPanel() {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Booster[] | null>(null);
  const [activePercent, setActivePercent] = useState(0);
  const [activeSpins, setActiveSpins] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    void api
      .boosters()
      .then((data) => {
        setItems(data.boosters);
        setActivePercent(data.active_percent);
        setActiveSpins(data.active_spins);
      })
      .catch(() => setItems([]));
  }, []);

  async function activate(booster: Booster) {
    if (busy !== null) return;
    setBusy(booster.id);
    try {
      const data = await api.activateBooster(booster.id);
      setItems((current) => (current ?? []).filter((item) => item.id !== booster.id));
      setActivePercent(data.active_percent);
      setActiveSpins(data.active_spins);
      hapticNotify('success');
      toast(`Бустер +${booster.percent}% активирован`, 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось активировать бустер', 'error');
    } finally {
      setBusy(null);
    }
  }

  const active = activeSpins > 0;

  return (
    <div>
      <div
        className={cn(
          'rounded-2xl border p-4',
          active
            ? 'border-teal/25 bg-gradient-to-br from-teal/[0.09] to-transparent'
            : 'border-white/[0.06] bg-ink-800',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal/25 bg-teal/10 text-teal">
            <Zap size={16} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-paper">Активный бустер</div>
            <div className="text-[8px] text-muted/55">
              {active ? 'действует сейчас' : 'не активирован'}
            </div>
          </div>
        </div>
        {active ? (
          <div className="mt-3 font-display text-2xl font-semibold text-teal">
            +{activePercent.toFixed(0)}%
          </div>
        ) : (
          <p className="mt-3 text-[8px] text-muted/60">
            Бустеры из кейсов лежат здесь, пока ты их не активируешь.
          </p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {items === null ? (
          <div className="h-20 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.05] bg-ink-800/50 p-4 text-center text-[9px] text-muted/55">
            Нет неактивных бустеров
          </div>
        ) : (
          items.map((booster) => (
            <div
              key={booster.id}
              className="flex items-center gap-3 rounded-2xl border border-teal/15 bg-ink-800 p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal/20 bg-teal/10 text-teal">
                <Zap size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-paper">
                  Удача +{booster.percent}%
                </div>
                <div className="text-[8px] text-muted/55">на {booster.spins} круток</div>
              </div>
              <button
                type="button"
                onClick={() => void activate(booster)}
                disabled={busy !== null}
                className="rounded-lg border border-teal/30 bg-teal/10 px-2.5 py-1.5 text-[8px] font-semibold text-teal disabled:opacity-50"
              >
                {busy === booster.id ? '…' : 'Активировать'}
              </button>
            </div>
          ))
        )}
      </div>

      <Link
        to="/cases"
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/25 bg-gold/10 py-2.5 text-[9px] font-semibold text-gold"
      >
        <KeyRound size={11} /> Открыть кейс
      </Link>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-medium transition',
        active
          ? 'border-accent/45 bg-accent/12 text-paper'
          : 'border-white/[0.05] bg-ink-800/60 text-muted hover:text-paper/80',
      )}
      style={active && color ? { borderColor: `${color}70`, color, background: `${color}16` } : undefined}
    >
      {label}
    </button>
  );
}

function InventoryCard({
  item,
  selected,
  onToggle,
  onSell,
}: {
  item: InventoryItem;
  selected: boolean;
  onToggle: () => void;
  onSell: () => void;
}) {
  const meta = RARITY[item.domain.rarity];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'relative overflow-hidden rounded-xl border p-2.5 transition active:scale-[0.99]',
        selected ? 'border-accent/60 bg-accent/[0.07]' : 'border-white/[0.06] bg-ink-800',
      )}
    >
      <div className="flex items-start justify-between">
        <RarityBadge rarity={item.domain.rarity} />
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md border',
            selected
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-white/15 bg-white/[0.02] text-transparent',
          )}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </div>

      <div className="mt-4 min-h-[42px]">
        <div className="truncate font-display text-[15px] font-semibold leading-tight tracking-tight text-paper">
          {item.domain.name}
        </div>
        <div className="mt-0.5 text-[10px] font-medium" style={{ color: meta.color }}>
          {item.domain.zone}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2">
        <span className="font-display text-[10px] font-semibold text-paper/80">
          {formatNumber(item.domain.price)} D
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            hapticImpact('light');
            onSell();
          }}
          className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-1 text-[8px] font-medium text-muted transition hover:text-paper"
        >
          Продать
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[144px] animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02]"
        />
      ))}
    </div>
  );
}
