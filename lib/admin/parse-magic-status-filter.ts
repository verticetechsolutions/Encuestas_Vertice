import {
  VALID_MAGIC_STATUSES,
  type MagicStatus,
} from './magic-token-status';

const DEFAULT_FILTER: MagicStatus[] = ['vigente', 'consumido'];

export function parseMagicStatusFilter(
  raw: string | undefined
): MagicStatus[] {
  if (!raw) return DEFAULT_FILTER;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = parts.filter((s): s is MagicStatus =>
    (VALID_MAGIC_STATUSES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : DEFAULT_FILTER;
}
