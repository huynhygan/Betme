import type { Enums } from '../../types/database';
import type { LockOption } from '../../lib/lockTime';

const NEW_BET_DRAFT_KEY = 'betme:new-bet-draft';

export type NewBetDraft = {
  title: string;
  outcomes: string[];
  lockOption: LockOption | null;
  customLocksAt: string;
  visibility: Enums<'bet_visibility'> | null;
  resolutionMethod: Enums<'resolution_method'>;
  stakeOutcomeIndex: number | null;
  stakeKind: Enums<'stake_kind'> | null;
  stakeLabel: string;
};

export const EMPTY_DRAFT: NewBetDraft = {
  title: '',
  outcomes: ['', ''],
  lockOption: null,
  customLocksAt: '',
  visibility: null,
  resolutionMethod: 'unanimous',
  stakeOutcomeIndex: null,
  stakeKind: null,
  stakeLabel: '',
};

export function loadDraft(): NewBetDraft {
  try {
    const raw = localStorage.getItem(NEW_BET_DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<NewBetDraft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: NewBetDraft) {
  localStorage.setItem(NEW_BET_DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(NEW_BET_DRAFT_KEY);
}
