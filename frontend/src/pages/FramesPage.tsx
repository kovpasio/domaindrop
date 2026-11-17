import { useEffect, useState } from 'react';
import { Check, Lock, ShoppingBag, Sparkles } from 'lucide-react';
import { ApiError, api } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { FramesResponse } from '@/types';
import { formatNumber } from '@/lib/utils';

export function FramesPage() {
  const { me, applyBalance, refresh } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<FramesResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setData(await api.frames());
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function buy(key: string) {
    if (!data || busy) return;
    setBusy(key);
    try {
      const next = await api.buyFrame(key);
      applyBalance(next.balance);
      setData(next);
      toast('Рамка куплена', 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Не удалось купить рамку', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function equip(key: string) {
    if (!data || busy) return;
    setBusy(key);
    try {
      const next = await api.equipFrame(key);
      setData(next);
      toast('Рамка установлена', 'success');
      await refresh();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Не удалось установить рамку', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="profile frames"
        title="Рамки"
        description="Купите рамку за монеты или откройте её достижением."
        action={
          me ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-2.5 py-2 text-[10px] font-semibold text-paper">
              {formatNumber(me.user.balance)} D
            </div>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {(data?.frames ?? []).map((frame) => (
          <div
            key={frame.key}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              frame.equipped
                ? 'border-accent/35 bg-accent/[0.06]'
                : 'border-white/[0.06] bg-ink-800'
            }`}
          >
            <Avatar name={me?.user.display_name ?? 'Domain Drop'} size={48} frame={frame.key} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-semibold text-paper">{frame.title}</span>
                {frame.equipped && <Check size={11} className="text-teal" />}
              </div>
              <div className="mt-0.5 truncate text-[8px] text-muted/60">{frame.description}</div>
              <div className="mt-1 text-[7px] uppercase tracking-[0.08em] text-muted/45">
                {frame.achievement ? 'за достижение' : frame.price === 0 ? 'базовая' : `${formatNumber(frame.price ?? 0)} D`}
              </div>
            </div>
            {frame.equipped ? (
              <span className="rounded-lg border border-teal/25 bg-teal/10 px-2 py-1.5 text-[8px] font-semibold text-teal">
                выбрана
              </span>
            ) : frame.owned ? (
              <button
                type="button"
                onClick={() => void equip(frame.key)}
                disabled={busy !== null}
                className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[8px] font-semibold text-accent-soft disabled:opacity-50"
              >
                Надеть
              </button>
            ) : frame.achievement ? (
              <span className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[8px] text-muted/50">
                <Lock size={10} /> закрыто
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void buy(frame.key)}
                disabled={busy !== null || (me?.user.balance ?? 0) < (frame.price ?? 0)}
                className="flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-[8px] font-semibold text-gold disabled:opacity-50"
              >
                <ShoppingBag size={10} /> Купить
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.05] bg-ink-800/50 p-3 text-[9px] leading-relaxed text-muted/60">
        <Sparkles size={12} className="mt-0.5 shrink-0 text-accent-soft" />
        Рамки не влияют на удачу и рейтинг. Некоторые открываются автоматически за достижения.
      </div>
    </div>
  );
}
