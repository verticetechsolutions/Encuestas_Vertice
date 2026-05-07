import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tiempo relativo es-MX, low-effort. Para fechas <1min muestra "hace un momento";
// luego minutos, horas, días; >30 días cae a fecha absoluta dd/mm/yyyy.
// Server-rendered: las fechas vienen de Postgres (Date objects de Drizzle).
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffSec = Math.round((now - d.getTime()) / 1000);
  if (diffSec < 60) return 'hace un momento';
  if (diffSec < 3600) {
    const m = Math.round(diffSec / 60);
    return `hace ${m} min`;
  }
  if (diffSec < 86400) {
    const h = Math.round(diffSec / 3600);
    return `hace ${h} h`;
  }
  if (diffSec < 86400 * 30) {
    const d2 = Math.round(diffSec / 86400);
    return `hace ${d2} d`;
  }
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
