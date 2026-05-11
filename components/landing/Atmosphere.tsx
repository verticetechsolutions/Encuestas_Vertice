// components/landing/Atmosphere.tsx
//
// Overlay layer para hero/manifest backgrounds. Wraps existing
// .atmosphere-radial-gold y .atmosphere-noise utilities. Pointer-events
// disabled, absolutely positioned al contenedor padre relative.

import { cn } from '@/lib/utils';

type Variant = 'radial-gold' | 'noise' | 'both';

interface AtmosphereProps {
  variant?: Variant;
  className?: string;
}

export function Atmosphere({ variant = 'both', className }: AtmosphereProps) {
  const showRadial = variant === 'radial-gold' || variant === 'both';
  const showNoise = variant === 'noise' || variant === 'both';
  return (
    <>
      {showRadial && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 atmosphere-radial-gold',
            className,
          )}
        />
      )}
      {showNoise && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 atmosphere-noise',
            className,
          )}
        />
      )}
    </>
  );
}
