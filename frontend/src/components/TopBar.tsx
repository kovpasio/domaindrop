import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { cn, formatNumber } from '@/lib/utils';
import { Coin } from '@/components/Coin';
import { Logo } from '@/components/Logo';

export function TopBar() {
  const { me } = useAuth();
  const { enabled, toggle } = useSound();
  const [keyPulse, setKeyPulse] = useState(0);
  const [keyGain, setKeyGain] = useState(0);
  const keyTimer = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDrop = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      setKeyPulse((current) => current + 1);
      setKeyGain(detail?.count ?? 1);
      if (keyTimer.current) window.clearTimeout(keyTimer.current);
      keyTimer.current = window.setTimeout(() => setKeyGain(0), 1400);
    };
    window.addEventListener('dropzone:key-drop', onKeyDrop);
    return () => {
      window.removeEventListener('dropzone:key-drop', onKeyDrop);
      if (keyTimer.current) window.clearTimeout(keyTimer.current);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-white/[0.06] bg-ink-950/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-[56px] w-full max-w-md items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <motion.div
              key={keyPulse}
              animate={
                keyPulse
                  ? { scale: [1, 1.22, 1], rotate: [0, -5, 5, 0] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="relative"
            >
              <Link
                to="/cases"
                aria-label="Кейсы и ключи"
                className="flex h-9 items-center gap-1 rounded-xl border border-gold/25 bg-gold/[0.08] px-2 text-gold transition hover:border-gold/50 active:scale-95"
              >
                <motion.span
                  animate={keyPulse ? { rotate: [0, -14, 14, 0] } : undefined}
                  transition={{ duration: 0.5 }}
                >
                  <KeyRound size={14} />
                </motion.span>
                <span className="font-display text-[11px] font-bold tabular-nums">
                  {me ? me.user.case_keys : '—'}
                </span>
              </Link>
              <AnimatePresence>
                {keyGain > 0 && (
                  <motion.span
                    initial={{ opacity: 0, y: 8, scale: 0.7 }}
                    animate={{ opacity: 1, y: -20, scale: 1 }}
                    exit={{ opacity: 0, y: -28, scale: 0.85 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full border border-gold/40 bg-ink-900 px-1.5 py-0.5 font-display text-[9px] font-bold text-gold shadow-[0_0_14px_rgba(242,165,74,0.35)]"
                  >
                    +{keyGain}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
            <button
              type="button"
              onClick={toggle}
              aria-label={enabled ? 'Выключить звук' : 'Включить звук'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-muted transition hover:text-paper active:scale-95"
            >
              {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <Link
              to="/"
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/[0.08] px-2.5',
                'transition hover:border-accent/50 active:scale-95',
              )}
            >
              <Coin size={16} />
              <span className="font-display text-[13px] font-bold tabular-nums text-[#E6F1FF]">
                {me ? formatNumber(me.user.balance) : '—'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
