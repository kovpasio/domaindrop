import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Globe2, KeyRound, Loader2, PackageOpen, Sparkles, Zap } from 'lucide-react';
import { ApiError, api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { CaseOpening, CasesResponse } from '@/types';
import { cn, hapticImpact, hapticNotify } from '@/lib/utils';

const KIND_META = {
  domain: { icon: Globe2, color: '#4D9BFF', label: 'Домен' },
  cosmetic: { icon: Sparkles, color: '#B07CFF', label: 'Косметика' },
  booster: { icon: Zap, color: '#43D6C5', label: 'Бустер' },
} as const;

export function CasesPanel() {
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<CasesResponse | null>(null);
  const [opening, setOpening] = useState<CaseOpening | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const next = await api.cases();
      setData(next);
      setOpening(next.pending);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openCase(key: string) {
    if (!data || busy) return;
    setBusy(key);
    hapticImpact('medium');
    try {
      const next = await api.openCase(key);
      setOpening(next);
      setData((current) => (current ? { ...current, keys: next.keys } : current));
      void refresh().catch(() => undefined);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Не удалось открыть кейс', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function choose(index: number) {
    if (!opening || busy) return;
    setBusy(`offer-${index}`);
    try {
      const result = await api.chooseCaseReward(opening.opening_id, index);
      hapticNotify('success');
      toast(result.message, 'success');
      setOpening(null);
      await refresh();
      await load();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Не удалось выбрать награду', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/[0.06] px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-paper">
            <KeyRound size={14} className="text-gold" /> Ключи
          </div>
          <div className="mt-0.5 text-[8px] text-muted/60">
            Ключи выдаются за ежедневные задания
          </div>
        </div>
        <div className="font-display text-2xl font-semibold text-gold">
          {data?.keys ?? me?.user.case_keys ?? 0}
        </div>
      </div>

      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 rounded-2xl border border-accent/25 bg-accent/[0.05] p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold text-paper">{opening.title}</div>
                <div className="mt-0.5 text-[8px] text-muted/60">
                  Выберите одну из трёх наград
                </div>
              </div>
              <PackageOpen size={18} className="text-accent-soft" />
            </div>
            <div className="mt-3 space-y-2">
              {opening.offers.map((offer, index) => {
                const meta = KIND_META[offer.kind] ?? KIND_META.booster;
                const Icon = meta.icon;
                return (
                  <button
                    key={`${offer.kind}-${index}`}
                    type="button"
                    onClick={() => void choose(index)}
                    disabled={busy !== null}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-900/70 p-3 text-left transition hover:border-white/[0.18] active:scale-[0.99] disabled:opacity-60"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: `${meta.color}35`,
                        background: `${meta.color}12`,
                        color: meta.color,
                      }}
                    >
                      {busy === `offer-${index}` ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Icon size={17} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold text-paper">
                          {offer.title}
                        </span>
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[6px] font-bold uppercase tracking-wide"
                          style={{ background: `${meta.color}20`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[8px] text-muted/60">
                        {offer.description}
                      </div>
                    </div>
                    <Check size={14} className="shrink-0 text-muted/30" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {(data?.cases ?? []).map((item) => {
          const affordable = (data?.keys ?? 0) >= item.cost;
          return (
            <div
              key={item.key}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-800 p-3.5"
            >
              <div
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[35px]"
                style={{ background: `${item.accent}25` }}
              />
              <div className="relative flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: `${item.accent}35`,
                    background: `${item.accent}12`,
                    color: item.accent,
                  }}
                >
                  <PackageOpen size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-paper">{item.title}</div>
                  <div className="mt-0.5 text-[8px] leading-relaxed text-muted/60">
                    {item.description}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[7px] text-muted/45">
                    {item.rarities.join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void openCase(item.key)}
                  disabled={!affordable || busy !== null || Boolean(opening)}
                  className={cn(
                    'flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-2 text-[8px] font-semibold transition',
                    affordable && !opening
                      ? 'border-gold/35 bg-gold/10 text-gold active:scale-95'
                      : 'border-white/[0.06] bg-white/[0.03] text-muted/40',
                  )}
                >
                  <span className="flex items-center gap-1">
                    {busy === item.key ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <KeyRound size={10} />
                    )}
                    {item.cost}
                  </span>
                  <span>открыть</span>
                </button>
              </div>
            </div>
          );
        })}
        {!data && (
          <div className="rounded-2xl border border-white/[0.05] bg-ink-800/60 p-4 text-[9px] text-muted/50">
            Загрузка кейсов…
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.05] bg-ink-800/50 p-3 text-[8px] leading-relaxed text-muted/55">
        <Sparkles size={12} className="mt-0.5 shrink-0 text-accent-soft" />
        В каждом кейсе три случайные награды. Шанс косметики — 2.5%, остальное делится между доменами и бустерами.
      </div>
    </div>
  );
}
