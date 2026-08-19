export const XP_PER_STEP = 20;

export function toDateKey(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) {
    return String(d).slice(0, 10);
  }
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

const LEVELS: Array<{ min: number; level: string; label: string }> = [
  { min: 120, level: 'elementary', label: 'Elementary (HSK 2+)' },
  { min: 60, level: 'beginner_2', label: 'Beginner II' },
  { min: 20, level: 'beginner_1', label: 'Beginner I' },
  { min: 0, level: 'absolute_beginner', label: 'Absolute beginner' },
];

export function levelFromKnown(known: number): string {
  return (LEVELS.find((l) => known >= l.min) ?? LEVELS[LEVELS.length - 1]).level;
}

export function levelLabel(level: string): string {
  return LEVELS.find((l) => l.level === level)?.label ?? level.replace(/_/g, ' ');
}

export function nextStreak(lastActive: string | null | undefined, current: number): number {
  if (!lastActive) return 1;
  const last = toDateKey(lastActive);
  if (last === todayKey()) return Math.max(current, 1);
  if (last === toDateKey(new Date(Date.now() - 86400000))) return current + 1;
  return 1;
}