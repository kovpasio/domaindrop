import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useTelegram } from '@/hooks/useTelegram';
import { ProfilePage } from '@/pages/ProfilePage';
import { RoulettePage } from '@/pages/RoulettePage';
import { InventoryPage } from '@/pages/InventoryPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { AdminPage } from '@/pages/AdminPage';
import { DropsPage } from '@/pages/DropsPage';
import { EarningsPage } from '@/pages/EarningsPage';
import { UpgraderPage } from '@/pages/UpgraderPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MorePage } from '@/pages/MorePage';
import { StatisticsPage } from '@/pages/StatisticsPage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import { FramesPage } from '@/pages/FramesPage';
import { ThemesPage } from '@/pages/ThemesPage';
import { CasesPage } from '@/pages/CasesPage';
import { applyTheme } from '@/lib/themes';

export default function App() {
  const { loading, error, me, retry } = useAuth();
  useTelegram();

  useEffect(() => {
    applyTheme(me?.user.theme_key, me?.user.theme_accent);
  }, [me?.user.theme_key, me?.user.theme_accent]);

  if (loading) return <Splash />;

  if (error || !me) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 [min-height:100dvh]">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-rarity-mythic/[0.06] blur-[100px]" />
        <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-ink-800 p-7 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-rarity-mythic/20 bg-rarity-mythic/10 text-rarity-mythic">
            <WifiOff size={24} />
          </div>
          <h1 className="font-display text-xl font-semibold text-paper">Нет подключения</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {error ?? 'Не удалось загрузить профиль.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-display text-sm font-semibold text-accent-contrast transition active:scale-[0.98]"
          >
            <RefreshCw size={16} />
            Попробовать снова
          </button>
          <p className="mt-4 text-[10px] leading-relaxed text-muted/70">
            Демо-режим работает в браузере. Для Telegram откройте Mini App через бота.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ProfilePage />} />
        <Route path="/roulette" element={<RoulettePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/earn" element={<EarningsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/drops" element={<DropsPage />} />
        <Route path="/upgrader" element={<UpgraderPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/frames" element={<FramesPage />} />
        <Route path="/themes" element={<ThemesPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Splash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-ink-950">
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.05] blur-[100px]" />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center"
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/20 via-accent/10 to-teal/10 shadow-neon-lime">
          <span className="font-display text-2xl font-bold tracking-tighter text-paper">
            D<span className="bg-gradient-to-b from-accent-soft to-teal bg-clip-text text-transparent">↓</span>
          </span>
        </div>
        <div className="mt-5 font-display text-[13px] font-semibold tracking-[0.28em] text-paper">
          DOMAIN <span className="text-accent-soft">DROP</span>
        </div>
        <div className="mt-2 text-[9px] uppercase tracking-[0.32em] text-muted/60">
          loading the drop engine
        </div>
        <div className="mt-8 h-[2px] w-32 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full w-1/2 rounded-full bg-accent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
