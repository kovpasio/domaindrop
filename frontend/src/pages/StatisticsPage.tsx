import { BarChart3, TrendingUp } from 'lucide-react';
import { PageTitle } from '@/components/PageTitle';
import { useAuth } from '@/context/AuthContext';
import { formatNumber } from '@/lib/utils';

export function StatisticsPage() {
  const { me } = useAuth();
  if (!me) return null;
  const { stats, user } = me;

  const items = [
    { label: 'Всего спинов', value: formatNumber(user.total_spins), accent: 'text-paper' },
    { label: 'Заработано', value: `${formatNumber(stats.total_earned)} D`, accent: 'text-teal' },
    { label: 'Потрачено', value: `${formatNumber(stats.total_spent)} D`, accent: 'text-gold' },
    {
      label: 'Лучший дроп',
      value: `${formatNumber(stats.best_drop)} D`,
      accent: 'text-rarity-legendary',
    },
    { label: 'Mythic-дропы', value: formatNumber(stats.mythic_drops), accent: 'text-rarity-mythic' },
    {
      label: 'Апгрейды',
      value: `${formatNumber(stats.upgrades_success)} / ${formatNumber(stats.upgrades_total)}`,
      accent: 'text-accent-soft',
    },
    {
      label: 'Крупнейшая продажа',
      value: `${formatNumber(stats.biggest_sale)} D`,
      accent: 'text-teal',
    },
    {
      label: 'Доменов в коллекции',
      value: formatNumber(stats.collection_count),
      accent: 'text-paper',
    },
  ];

  return (
    <div>
      <PageTitle
        eyebrow="player stats"
        title="Статистика"
        description="История спинов, продаж, апгрейдов и лучших дропов."
      />

      <div className="rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-paper">
          <BarChart3 size={13} className="text-accent-soft" /> Ваши показатели
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.05] bg-ink-900/60 px-3 py-3">
              <div className="text-[7px] uppercase tracking-[0.1em] text-muted/50">{item.label}</div>
              <div className={`mt-1 truncate font-display text-[13px] font-semibold ${item.accent}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.05] bg-ink-800/50 p-3 text-[9px] leading-relaxed text-muted/60">
        <TrendingUp size={12} className="mt-0.5 shrink-0 text-accent-soft" />
        Статистика считается по истории спинов, инвентаря и апгрейдов, а не по текущему балансу.
      </div>
    </div>
  );
}
