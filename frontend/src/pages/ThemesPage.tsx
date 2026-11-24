import { useState } from 'react';
import { Check, Loader2, Palette, Sparkles } from 'lucide-react';
import { ApiError, api } from '@/api/client';
import { PageTitle } from '@/components/PageTitle';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { THEME_PRESETS, applyTheme } from '@/lib/themes';
import { cn, hapticImpact, hapticNotify } from '@/lib/utils';

export function ThemesPage() {
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState(me?.user.theme_key ?? 'midnight');
  const [accent, setAccent] = useState(me?.user.theme_accent ?? '#4F9DFF');
  const [saving, setSaving] = useState(false);

  function choosePreset(key: string) {
    hapticImpact('light');
    setSelected(key);
    setAccent(THEME_PRESETS.find((item) => item.key === key)?.accent ?? '#4F9DFF');
    applyTheme(key, null);
  }

  function chooseCustom(value: string) {
    setSelected('custom');
    setAccent(value);
    applyTheme('custom', value);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await api.updateTheme(selected, selected === 'custom' ? accent : null);
      await refresh();
      applyTheme(selected, selected === 'custom' ? accent : null);
      hapticNotify('success');
      toast('Тема сохранена', 'success');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Не удалось сохранить тему', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="appearance"
        title="Темы"
        description="Выберите готовую палитру или собственный цвет приложения."
        action={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-soft">
            <Palette size={16} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        {THEME_PRESETS.map((theme) => {
          const active = selected === theme.key;
          return (
            <button
              key={theme.key}
              type="button"
              onClick={() => choosePreset(theme.key)}
              className={cn(
                'overflow-hidden rounded-2xl border p-2.5 text-left transition active:scale-[0.99]',
                active ? 'border-accent/60 bg-accent/[0.08]' : 'border-white/[0.06] bg-ink-800',
              )}
            >
              <div
                className="h-14 rounded-xl border border-white/[0.08]"
                style={{
                  background: `linear-gradient(135deg, ${theme.surface}, ${theme.accent}55)`,
                }}
              >
                <div className="flex h-full items-center justify-center gap-1.5">
                  <span className="h-5 w-5 rounded-full" style={{ background: theme.accent }} />
                  <span className="h-2 w-9 rounded-full bg-white/70" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-paper">{theme.title}</span>
                {active && <Check size={11} className="text-teal" />}
              </div>
              <div className="mt-0.5 text-[7px] text-muted/55">{theme.description}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-paper">
          <Sparkles size={13} className="text-gold" /> Свой акцент
        </div>
        <p className="mt-1 text-[8px] leading-relaxed text-muted/60">
          Цвет кнопок, ссылок и подсветки. Фон остаётся из выбранной темы.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="color"
            value={accent}
            onChange={(event) => chooseCustom(event.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-white/[0.1] bg-ink-900 p-1"
            aria-label="Свой цвет"
          />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[12px] font-semibold uppercase text-paper">
              {accent}
            </div>
            <div className="mt-0.5 text-[8px] text-muted/50">
              {selected === 'custom' ? 'своя тема выбрана' : 'цвет применится после выбора'}
            </div>
          </div>
          <input
            type="text"
            value={accent}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setAccent(value);
              if (/^#[0-9A-F]{6}$/.test(value)) {
                chooseCustom(value);
              }
            }}
            className="field w-[96px] px-2 py-2 text-center font-mono text-[11px]"
            maxLength={7}
            aria-label="HEX-цвет"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-display text-[12px] font-semibold text-white transition hover:bg-accent-soft disabled:opacity-60"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        {saving ? 'Сохраняем…' : 'Применить тему'}
      </button>
    </div>
  );
}
