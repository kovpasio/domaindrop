import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Howl } from 'howler';
import type { Rarity } from '@/types';

interface SoundContextValue {
  enabled: boolean;
  toggle: () => void;
  playTick: () => void;
  playReveal: (rarity: Rarity) => void;
  playCoin: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);
const SOUND_KEY = 'dropzone.sound';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(SOUND_KEY) !== 'off');
  const sounds = useRef<{
    tick?: Howl;
    reveal?: Howl;
    legendary?: Howl;
    mythic?: Howl;
    coin?: Howl;
  }>({});

  useEffect(() => {
    sounds.current = {
      tick: new Howl({ src: ['/sounds/tick.wav'], volume: 0.18, preload: true }),
      reveal: new Howl({ src: ['/sounds/reveal.wav'], volume: 0.5, preload: true }),
      legendary: new Howl({
        src: ['/sounds/legendary.wav'],
        volume: 0.6,
        preload: true,
      }),
      mythic: new Howl({ src: ['/sounds/mythic.wav'], volume: 0.65, preload: true }),
      coin: new Howl({ src: ['/sounds/coin.wav'], volume: 0.35, preload: true }),
    };
    return () => {
      Object.values(sounds.current).forEach((sound) => sound?.unload());
      sounds.current = {};
    };
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      return next;
    });
  }, []);

  const playTick = useCallback(() => {
    if (!enabled) return;
    const sound = sounds.current.tick;
    if (!sound) return;
    sound.rate(0.94 + Math.random() * 0.14);
    sound.play();
  }, [enabled]);

  const playReveal = useCallback(
    (rarity: Rarity) => {
      if (!enabled) return;
      if (rarity === 'mythic') {
        sounds.current.mythic?.play();
      } else if (rarity === 'legendary') {
        sounds.current.legendary?.play();
      } else {
        sounds.current.reveal?.play();
      }
    },
    [enabled],
  );

  const playCoin = useCallback(() => {
    if (!enabled) return;
    sounds.current.coin?.play();
  }, [enabled]);

  const value = useMemo(
    () => ({ enabled, toggle, playTick, playReveal, playCoin }),
    [enabled, toggle, playTick, playReveal, playCoin],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);
  if (!context) throw new Error('useSound must be used inside SoundProvider');
  return context;
}
