import { useState } from 'react';
import { cn, initials } from '@/lib/utils';
import { frameStyle } from '@/lib/frames';

const GRADIENTS = [
  'from-[#5FB3FF] via-[#4F9DFF] to-[#B07CFF]',
  'from-[#43D6C5] via-[#4D9BFF] to-[#2B6CCB]',
  'from-[#F2A54A] via-[#F06473] to-[#B07CFF]',
  'from-[#F06473] via-[#F2A54A] to-[#FFD27A]',
  'from-[#B07CFF] via-[#4F9DFF] to-[#43D6C5]',
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  glow?: boolean;
  frame?: string | null;
}

export function Avatar({
  src,
  name,
  size = 48,
  className,
  glow = false,
  frame = 'default',
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const style = frameStyle(frame);

  return (
    <div
      className={cn('relative shrink-0 rounded-full p-[1.5px]', className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${style.primary}, ${style.secondary})`,
        boxShadow:
          frame && frame !== 'default'
            ? `0 0 0 1px ${style.primary}35, 0 0 14px ${style.primary}55`
            : glow
              ? '0 0 18px rgba(79,157,255,0.28)'
              : undefined,
      }}
    >
      <div
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-display font-bold text-ink-950',
          gradientFor(name),
        )}
      >
        {showImage ? (
          <img
            src={src ?? ''}
            alt={name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span style={{ fontSize: Math.max(12, size * 0.34) }}>{initials(name) || 'DZ'}</span>
        )}
      </div>
    </div>
  );
}
