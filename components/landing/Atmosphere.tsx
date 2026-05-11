// components/landing/Atmosphere.tsx
//
// Overlay layer para hero/manifest backgrounds. Wraps las utility
// classes .atmosphere-*. Pointer-events disabled, absolutely positioned
// al contenedor padre relative.
//
// Wave 2 (2026-05-11): añade 3 variants nuevas:
//   - radial-gold-warm: radial amplio para hero impacto cálido
//   - radial-gold-cool: radial chico + frosted blue para morning brief
//   - noise-dense: noise 2.5% (vs default 1.2%) para cards detalle

import { cn } from '@/lib/utils';

type Variant =
  | 'radial-gold'
  | 'radial-gold-warm'
  | 'radial-gold-cool'
  | 'noise'
  | 'noise-dense'
  | 'both'
  | 'warm'   // alias: radial-gold-warm + noise
  | 'cool';  // alias: radial-gold-cool + noise

interface AtmosphereProps {
  variant?: Variant;
  className?: string;
}

function radialClassFor(variant: Variant): string | null {
  if (variant === 'radial-gold' || variant === 'both') return 'atmosphere-radial-gold';
  if (variant === 'radial-gold-warm' || variant === 'warm') return 'atmosphere-radial-gold-warm';
  if (variant === 'radial-gold-cool' || variant === 'cool') return 'atmosphere-radial-gold-cool';
  return null;
}

function noiseClassFor(variant: Variant): string | null {
  if (variant === 'noise' || variant === 'both' || variant === 'warm' || variant === 'cool') {
    return 'atmosphere-noise';
  }
  if (variant === 'noise-dense') return 'atmosphere-noise-dense';
  return null;
}

export function Atmosphere({ variant = 'both', className }: AtmosphereProps) {
  const radialClass = radialClassFor(variant);
  const noiseClass = noiseClassFor(variant);
  return (
    <>
      {radialClass && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0',
            radialClass,
            className,
          )}
        />
      )}
      {noiseClass && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0',
            noiseClass,
            className,
          )}
        />
      )}
    </>
  );
}
