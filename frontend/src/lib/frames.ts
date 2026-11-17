export interface FrameStyle {
  primary: string;
  secondary: string;
}

export const FRAME_STYLES: Record<string, FrameStyle> = {
  default: { primary: '#7E98B8', secondary: '#41536C' },
  ocean: { primary: '#4D9BFF', secondary: '#43D6C5' },
  sunset: { primary: '#F2A54A', secondary: '#F06473' },
  neon: { primary: '#B07CFF', secondary: '#43D6C5' },
  gold: { primary: '#FFD27A', secondary: '#F2A54A' },
  mythic: { primary: '#F05D6E', secondary: '#B07CFF' },
  frame_first_mythic: { primary: '#F05D6E', secondary: '#FFD27A' },
  frame_spins_1000: { primary: '#43D6C5', secondary: '#4D9BFF' },
  frame_collector_50: { primary: '#F2A54A', secondary: '#43D6C5' },
};

export function frameStyle(key: string | null | undefined): FrameStyle {
  return FRAME_STYLES[key ?? 'default'] ?? FRAME_STYLES.default;
}
