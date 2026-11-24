import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpFromLine, Coins, Dices, Ellipsis, Package, UserRound } from 'lucide-react';
import { cn, hapticSelection } from '@/lib/utils';

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof UserRound;
  activePaths?: string[];
};

const LEFT_ITEMS: NavItemDef[] = [
  { to: '/', label: 'Профиль', icon: UserRound },
  { to: '/inventory', label: 'Инвентарь', icon: Package },
];

const RIGHT_ITEMS: NavItemDef[] = [
  { to: '/earn', label: 'Заработок', icon: Coins },
  { to: '/upgrader', label: 'Апгрейдер', icon: ArrowUpFromLine },
  {
    to: '/more',
    label: 'Ещё',
    icon: Ellipsis,
    activePaths: ['/more', '/leaderboard', '/drops', '/settings', '/admin'],
  },
];

export function BottomNav() {
  const location = useLocation();
  const rouletteActive = location.pathname === '/roulette';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md">
      <div className="relative border-t border-white/[0.08] bg-ink-900/95 pb-[max(env(safe-area-inset-bottom),9px)] pt-1.5 backdrop-blur-xl">
        <div className="relative flex items-end px-1 pb-1.5">
          <div className="flex flex-1 justify-around">
            {LEFT_ITEMS.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                active={location.pathname === item.to}
              />
            ))}
          </div>

          <div className="w-[62px] shrink-0" />

          <div className="flex flex-1 justify-around">
            {RIGHT_ITEMS.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                active={
                  item.activePaths
                    ? item.activePaths.includes(location.pathname)
                    : location.pathname === item.to
                }
              />
            ))}
          </div>

          <Link
            to="/roulette"
            onClick={() => hapticSelection()}
            aria-label="Крутить рулетку"
            className={cn(
              'absolute left-1/2 top-[-24px] flex h-[54px] w-[54px] -translate-x-1/2 items-center justify-center rounded-2xl border transition active:scale-95',
              rouletteActive
                ? 'border-teal/60 bg-gradient-to-br from-accent to-teal text-[#07111D] shadow-neon-lime'
                : 'border-accent/50 bg-gradient-to-br from-accent/90 to-accent-deep text-accent-contrast shadow-neon-lime',
            )}
          >
            <Dices size={24} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof UserRound;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={() => hapticSelection()}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1 pb-1 pt-1 transition',
        active ? 'text-paper' : 'text-muted/65 hover:text-paper/80',
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      <span className="w-full truncate text-center text-[7px] font-medium leading-none">
        {label}
      </span>
      {active && (
        <motion.span
          layoutId="nav-dot"
          className="absolute top-0 h-[2px] w-4 rounded-full bg-accent-soft"
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
    </Link>
  );
}
