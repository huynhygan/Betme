import { resolveLocksAt } from '../../lib/lockTime';
import type { NewBetDraft } from './draft';

export function isTitleStepValid(draft: NewBetDraft): boolean {
  return draft.title.trim().length > 0 && draft.title.trim().length <= 200;
}

export function isOutcomesStepValid(draft: NewBetDraft): boolean {
  const trimmed = draft.outcomes.map((o) => o.trim());
  if (trimmed.length < 2 || trimmed.length > 8) return false;
  if (trimmed.some((o) => o.length === 0)) return false;
  const unique = new Set(trimmed.map((o) => o.toLowerCase()));
  return unique.size === trimmed.length;
}

export function isLockTimeStepValid(draft: NewBetDraft): boolean {
  if (!draft.lockOption) return false;
  const resolved = resolveLocksAt(draft.lockOption, draft.customLocksAt);
  return resolved !== null && resolved.getTime() > Date.now();
}

export function isVisibilityStepValid(draft: NewBetDraft): boolean {
  return draft.visibility !== null;
}

export function isResolutionMethodStepValid(draft: NewBetDraft): boolean {
  return draft.resolutionMethod !== null;
}

export function isReviewStepValid(draft: NewBetDraft): boolean {
  return (
    draft.stakeOutcomeIndex !== null &&
    draft.stakeOutcomeIndex >= 0 &&
    draft.stakeOutcomeIndex < draft.outcomes.length &&
    draft.stakeKind !== null &&
    draft.stakeLabel.trim().length > 0 &&
    draft.stakeLabel.trim().length <= 200
  );
}
