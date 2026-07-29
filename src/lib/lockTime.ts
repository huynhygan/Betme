export type LockOption = '1_hour' | 'tonight' | 'tomorrow' | 'custom';

export const LOCK_OPTION_LABELS: Record<LockOption, string> = {
  '1_hour': 'In 1 hour',
  tonight: 'Tonight',
  tomorrow: 'Tomorrow',
  custom: 'Custom',
};

export function computeQuickLocksAt(option: Exclude<LockOption, 'custom'>, now = new Date()): Date {
  if (option === '1_hour') {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  const target = new Date(now);
  target.setHours(23, 59, 0, 0);

  if (option === 'tomorrow') {
    target.setDate(target.getDate() + 1);
  } else if (target <= now) {
    // 'tonight' requested in the last minute before midnight — roll to
    // tomorrow rather than producing a locks_at that's already in the past.
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export function resolveLocksAt(option: LockOption, customLocksAt: string): Date | null {
  if (option === 'custom') {
    if (!customLocksAt) return null;
    const parsed = new Date(customLocksAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return computeQuickLocksAt(option);
}
