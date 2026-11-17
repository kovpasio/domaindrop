import type { Rarity } from '@/types';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.0', '')}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return formatNumber(value);
}

export function timeAgo(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const seconds = Math.floor(delta / 1000);
  if (seconds < 10) return 'только что';
  if (seconds < 60) return `${seconds} сек назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export function countdown(iso: string | null): string {
  if (!iso) return 'доступно';
  const delta = new Date(iso).getTime() - Date.now();
  if (delta <= 0) return 'доступно';
  const total = Math.ceil(delta / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}ч ${String(minutes).padStart(2, '0')}м`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function countdownHours(iso: string | null): string {
  if (!iso) return 'сейчас';
  const delta = new Date(iso).getTime() - Date.now();
  if (delta <= 0) return 'сейчас';
  const totalMinutes = Math.max(1, Math.ceil(delta / 60000));
  return `${Math.floor(totalMinutes / 60)}ч ${totalMinutes % 60}м`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY: Record<
  Rarity,
  {
    label: string;
    color: string;
    glow: string;
    gradient: string;
    soft: string;
    border: string;
    text: string;
    icon: string;
  }
> = {
  common: {
    label: 'Common',
    color: '#96A3B8',
    glow: 'rgba(150,163,184,.24)',
    gradient: 'from-[#96A3B8]/15 via-[#96A3B8]/4 to-transparent',
    soft: 'bg-[#96A3B8]/10',
    border: 'border-[#96A3B8]/25',
    text: 'text-[#BEC8D8]',
    icon: '◇',
  },
  rare: {
    label: 'Rare',
    color: '#4D9BFF',
    glow: 'rgba(77,155,255,.3)',
    gradient: 'from-[#4D9BFF]/20 via-[#4D9BFF]/5 to-transparent',
    soft: 'bg-[#4D9BFF]/10',
    border: 'border-[#4D9BFF]/32',
    text: 'text-[#82B8FF]',
    icon: '◈',
  },
  epic: {
    label: 'Epic',
    color: '#B07CFF',
    glow: 'rgba(176,124,255,.3)',
    gradient: 'from-[#B07CFF]/20 via-[#B07CFF]/5 to-transparent',
    soft: 'bg-[#B07CFF]/10',
    border: 'border-[#B07CFF]/34',
    text: 'text-[#C9A1FF]',
    icon: '✦',
  },
  legendary: {
    label: 'Legendary',
    color: '#F2A54A',
    glow: 'rgba(242,165,74,.3)',
    gradient: 'from-[#F2A54A]/20 via-[#F2A54A]/5 to-transparent',
    soft: 'bg-[#F2A54A]/10',
    border: 'border-[#F2A54A]/36',
    text: 'text-[#FFC078]',
    icon: '★',
  },
  mythic: {
    label: 'Mythic',
    color: '#F06473',
    glow: 'rgba(240,100,115,.32)',
    gradient: 'from-[#F06473]/20 via-[#F06473]/5 to-transparent',
    soft: 'bg-[#F06473]/10',
    border: 'border-[#F06473]/38',
    text: 'text-[#FF98A3]',
    icon: '☄',
  },
};

export const ZONE_META: Record<string, { label: string; className: string }> = {
  '.ru': { label: 'RU', className: 'text-[#82B8FF] bg-[#4D9BFF]/10 border-[#4D9BFF]/25' },
  '.com': { label: 'COM', className: 'text-[#C9A1FF] bg-[#B07CFF]/10 border-[#B07CFF]/25' },
  '.io': { label: 'IO', className: 'text-[#72E4D6] bg-[#43D6C5]/10 border-[#43D6C5]/25' },
  '.xyz': { label: 'XYZ', className: 'text-[#FFC078] bg-[#F2A54A]/10 border-[#F2A54A]/25' },
};

export function getTelegram() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') {
  getTelegram()?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type: 'error' | 'success' | 'warning') {
  getTelegram()?.HapticFeedback?.notificationOccurred(type);
}

export function hapticSelection() {
  getTelegram()?.HapticFeedback?.selectionChanged();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function shortHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
