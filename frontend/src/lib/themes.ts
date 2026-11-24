export interface ThemePreset {
  key: string;
  title: string;
  description: string;
  accent: string;
  surface: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'midnight',
    title: 'Полночь',
    description: 'Базовый тёмно-синий стиль',
    accent: '#4F9DFF',
    surface: '#182334',
  },
  {
    key: 'ocean',
    title: 'Океан',
    description: 'Глубокий сине-зелёный',
    accent: '#2ED6BE',
    surface: '#0E2C36',
  },
  {
    key: 'violet',
    title: 'Фиалка',
    description: 'Тёмный фиолетовый',
    accent: '#B27CFF',
    surface: '#241C3C',
  },
  {
    key: 'sunset',
    title: 'Закат',
    description: 'Тёплый красно-оранжевый',
    accent: '#FF965C',
    surface: '#39231F',
  },
  {
    key: 'emerald',
    title: 'Изумруд',
    description: 'Тёмный зелёный',
    accent: '#45D68A',
    surface: '#102D1F',
  },
  {
    key: 'mono',
    title: 'Монохром',
    description: 'Спокойный графитовый',
    accent: '#D7DEEA',
    surface: '#26272B',
  },
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mix(hex: string, target: number, amount: number): string {
  const [r, g, b] = rgb(hex);
  const channel = (value: number) => Math.round(value + (target - value) * amount);
  return `${channel(r)} ${channel(g)} ${channel(b)}`;
}

export function applyTheme(themeKey?: string | null, accentColor?: string | null): void {
  const root = document.documentElement;
  const safeTheme = themeKey && (themeKey === 'custom' || THEME_PRESETS.some((item) => item.key === themeKey))
    ? themeKey
    : 'midnight';
  root.dataset.theme = safeTheme;

  if (safeTheme === 'custom' && accentColor && HEX.test(accentColor)) {
    root.style.setProperty('--accent', mix(accentColor, 255, 0));
    root.style.setProperty('--accent-soft', mix(accentColor, 255, 0.38));
    root.style.setProperty('--accent-deep', mix(accentColor, 0, 0.24));
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-soft');
    root.style.removeProperty('--accent-deep');
  }
}
