import { useEffect, useState } from 'react';
import { Check, Lock, Target, Trophy } from 'lucide-react';
import { api } from '@/api/client';
import { PageTitle } from '@/components/PageTitle';
import type { Achievement } from '@/types';

export function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalLuck, setTotalLuck] = useState(0);

  useEffect(() => {
    void api
      .achievements()
      .then((response) => {
        setAchievements(response.achievements);
        setTotalLuck(response.total_luck);
      })
      .catch(() => undefined);
  }, []);

  const unlocked = achievements.filter((item) => item.unlocked).length;

  return (
    <div>
      <PageTitle
        eyebrow="achievements"
        title="Достижения"
        description="Открывайте достижения и получайте постоянный бонус к удаче."
      />

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <Trophy size={14} className="text-gold" />
          {unlocked} / {achievements.length} открыто
        </div>
        <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-1 text-[9px] font-bold text-gold">
          +{totalLuck.toFixed(1)}% удачи
        </span>
      </div>

      <div className="space-y-1.5">
        {achievements.map((achievement) => (
          <div
            key={achievement.key}
            className={`rounded-2xl border p-3 ${
              achievement.unlocked
                ? 'border-teal/20 bg-teal/[0.06]'
                : 'border-white/[0.055] bg-ink-800/60'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                  achievement.unlocked
                    ? 'border-teal/25 bg-teal/10 text-teal'
                    : 'border-white/[0.07] bg-white/[0.03] text-muted/40'
                }`}
              >
                {achievement.unlocked ? <Check size={13} /> : <Lock size={12} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold ${achievement.unlocked ? 'text-paper' : 'text-muted'}`}>
                    {achievement.title}
                  </span>
                  <span className="shrink-0 text-[8px] font-bold text-gold">+{achievement.luck}%</span>
                </div>
                <div className="mt-0.5 text-[8px] text-muted/60">{achievement.description}</div>
                {!achievement.unlocked && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-teal"
                        style={{
                          width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-[7px] tabular-nums text-muted/50">
                      {achievement.progress}/{achievement.target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.05] bg-ink-800/50 p-3 text-[9px] leading-relaxed text-muted/60">
        <Target size={12} className="mt-0.5 shrink-0 text-accent-soft" />
        Достижения открываются автоматически. Бонус удачи суммируется с уровнями и инвентарём до 40%.
      </div>
    </div>
  );
}
