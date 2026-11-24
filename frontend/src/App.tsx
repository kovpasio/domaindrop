import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useTelegram } from '@/hooks/useTelegram';
import { applyTheme } from '@/lib/themes';

const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const RoulettePage = lazy(() =>
  import('@/pages/RoulettePage').then((module) => ({ default: module.RoulettePage })),
);
const InventoryPage = lazy(() =>
  import('@/pages/InventoryPage').then((module) => ({ default: module.InventoryPage })),
);
const LeaderboardPage = lazy(() =>
  import('@/pages/LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })),
);
const AdminPage = lazy(() =>
  import('@/pages/AdminPage').then((module) => ({ default: module.AdminPage })),
);
const DropsPage = lazy(() =>
  import('@/pages/DropsPage').then((module) => ({ default: module.DropsPage })),
);
const EarningsPage = lazy(() =>
  import('@/pages/EarningsPage').then((module) => ({ default: module.EarningsPage })),
);
const UpgraderPage = lazy(() =>
  import('@/pages/UpgraderPage').then((module) => ({ default: module.UpgraderPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const MorePage = lazy(() =>
  import('@/pages/MorePage').then((module) => ({ default: module.MorePage })),
);
const StatisticsPage = lazy(() =>
  import('@/pages/StatisticsPage').then((module) => ({ default: module.StatisticsPage })),
);
const AchievementsPage = lazy(() =>
  import('@/pages/AchievementsPage').then((module) => ({ default: module.AchievementsPage })),
);
const CasesPage = lazy(() =>
  import('@/pages/CasesPage').then((module) => ({ default: module.CasesPage })),
);

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
    <Suspense fallback={<Splash />}>
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
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
