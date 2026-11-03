import { Link } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { cn, formatNumber } from '@/lib/utils';
import { Coin } from '@/components/Coin';
import { Logo } from '@/components/Logo';

export function TopBar() {
  const { me } = useAuth();
  const { enabled, toggle } = useSound();

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-white/[0.06] bg-ink-950/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-[56px] w-full max-w-md items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
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
