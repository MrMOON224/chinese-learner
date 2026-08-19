import type { Models } from 'appwrite';

export type VocabState = 'NEW' | 'LEARNING' | 'FAMILIAR' | 'MASTERED' | 'WEAK' | 'FORGOTTEN';

export type VocabRow = Models.Row & {
  word: string;
  pinyin: string;
  meaning: string;
  example: string;
  example_pinyin?: string;
  example_en?: string;
  state: VocabState;
  repetitions: number;
  interval_days: number;
  ease: number;
  due_at: string | null;
  last_review: string | null;
  lapses: number;
  source?: string;
};

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsResult {
  repetitions: number;
  intervalDays: number;
  ease: number;
  lapses: number;
  state: VocabState;
}

export function applySrs(v: Pick<VocabRow, 'repetitions' | 'interval_days' | 'ease' | 'lapses'>, grade: Grade): SrsResult {
  let { repetitions, interval_days, ease, lapses } = v;
  if (ease < 1.3) ease = 1.3;

  if (grade === 'again') {
    repetitions = 0;
    interval_days = 0;
    ease = Math.max(1.3, ease - 0.2);
    lapses += 1;
  } else if (grade === 'hard') {
    repetitions += 1;
    interval_days = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round(interval_days * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (grade === 'good') {
    repetitions += 1;
    interval_days = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(interval_days * ease);
  } else {
    repetitions += 1;
    interval_days = repetitions === 1 ? 1 : repetitions === 2 ? 10 : Math.round(interval_days * ease * 1.3);
    ease = Math.min(3.0, ease + 0.15);
  }

  let state: VocabState;
  if (grade === 'again') state = 'WEAK';
  else if (interval_days >= 21) state = 'MASTERED';
  else if (repetitions >= 2) state = 'FAMILIAR';
  else state = 'LEARNING';

  return { repetitions, intervalDays: interval_days, ease, lapses, state };
}

export function dueInDays(dueAt: string | null): number {
  if (!dueAt) return 0;
  const ms = new Date(dueAt).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}
