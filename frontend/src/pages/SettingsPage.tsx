import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Settings2, Sparkles } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/context/ToastContext';
import { PageTitle } from '@/components/PageTitle';
import type { AutosellSettings, Rarity } from '@/types';
import { cn, hapticImpact, hapticNotify, RARITY, RARITY_ORDER } from '@/lib/utils';

const EMPTY: AutosellSettings = {
  autosell_common: false,
  autosell_rare: false,
  autosell_epic: false,
  autosell_legendary: false,
  autosell_mythic: false,
  autosell_below_price: null,
};

const FLAG: Record<Rarity, keyof AutosellSettings> = {
  common: 'autosell_common',
  rare: 'autosell_rare',
  epic: 'autosell_epic',
  legendary: 'autosell_legendary',
  mythic: 'autosell_mythic',
};

export function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutosellSettings>(EMPTY);
  const [belowEnabled, setBelowEnabled] = useState(false);
  const [belowPrice, setBelowPrice] = useState('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void api
      .autosell()
      .then((data) => {
        if (!mounted) return;
        setSettings(data);
        setBelowEnabled(data.autosell_below_price !== null);
        if (data.autosell_below_price !== null) {
          setBelowPrice(String(data.autosell_below_price));
        }
      })
      .catch(() => {
        if (mounted) toast('Не удалось загрузить настройки', 'error');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [toast]);

  async function save() {
    if (saving) return;
    let threshold: number | null = null;
    if (belowEnabled) {
      const parsed = Number(belowPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast('Введите корректную цену', 'error');
        return;
      }
      threshold = parsed;
    }
    setSaving(true);
    hapticImpact('light');
    try {
      const result = await api.updateAutosell({
        ...settings,
        autosell_below_price: threshold,
      });
      setSettings(result);
      hapticNotify('success');
      toast('Настройки автопродажи сохранены', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось сохранить настройки', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        to="/more"
        className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-muted transition hover:text-paper"
      >
        <ArrowLeft size={12} /> Назад
      </Link>

      <PageTitle
        eyebrow="settings"
        title="Автопродажа"
        description="Домены, подходящие под правила, продаются сразу после спина. На баланс зачисляется полная цена, в инвентарь домен не попадает."
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02]"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-800">
            <div className="border-b border-white/[0.05] px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-paper">
                <Settings2 size={13} className="text-accent-soft" />
                По редкости
              </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {RARITY_ORDER.map((rarity) => {
                const key = FLAG[rarity];
                const enabled = Boolean(settings[key]);
                const meta = RARITY[rarity];
                return (
                  <div key={rarity} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div>
                        <div className="text-[11px] font-medium" style={{ color: meta.color }}>
                          {meta.label}
                        </div>
                        <div className="mt-0.5 text-[8px] text-muted/60">
                          Продавать сразу после выпадения
                        </div>
                      </div>
                    </div>
                    <Toggle
                      enabled={enabled}
                      onChange={() => {
                        hapticImpact('light');
                        setSettings((current) => ({ ...current, [key]: !enabled }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-paper">Продавать всё дешевле</div>
                <div className="mt-0.5 text-[9px] leading-relaxed text-muted">
                  Если цена домена ниже указанной — он сразу продаётся, и на баланс приходит
                  ровно эта сумма.
                </div>
              </div>
              <Toggle enabled={belowEnabled} onChange={() => setBelowEnabled((value) => !value)} />
            </div>
            <div
              className={cn(
                'mt-3 flex items-center gap-2 transition',
                !belowEnabled && 'pointer-events-none opacity-40',
              )}
            >
              <input
                inputMode="numeric"
                value={belowPrice}
                onChange={(event) => setBelowPrice(event.target.value.replace(/\D/g, ''))}
                className="field max-w-[140px] text-right font-display text-lg"
                disabled={!belowEnabled}
              />
              <span className="text-[11px] text-muted">монет</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/[0.06] px-3.5 py-3 text-[9px] leading-relaxed text-muted">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-accent-soft" />
            Продажа всегда зачисляет полную цену. Редкость Mythic можно отключить, чтобы
            сохранить дорогой домен в коллекции.
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-display text-[12px] font-semibold text-accent-contrast transition hover:bg-accent-soft disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? 'Сохраняем…' : 'Сохранить настройки'}
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition',
        enabled ? 'border-accent/50 bg-accent' : 'border-white/[0.12] bg-white/[0.06]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 rounded-full bg-white transition-all',
          enabled ? 'left-[23px]' : 'left-0.5',
        )}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}
