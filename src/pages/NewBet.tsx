import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { WizardShell } from './new-bet/WizardShell';
import { TitleStep } from './new-bet/TitleStep';
import { OutcomesStep } from './new-bet/OutcomesStep';
import { LockTimeStep } from './new-bet/LockTimeStep';
import { VisibilityStep } from './new-bet/VisibilityStep';
import { ResolutionMethodStep } from './new-bet/ResolutionMethodStep';
import { ReviewStep } from './new-bet/ReviewStep';
import { EMPTY_DRAFT, loadDraft, saveDraft, clearDraft, type NewBetDraft } from './new-bet/draft';
import {
  isTitleStepValid,
  isOutcomesStepValid,
  isLockTimeStepValid,
  isVisibilityStepValid,
  isResolutionMethodStepValid,
  isReviewStepValid,
} from './new-bet/validity';
import { resolveLocksAt } from '../lib/lockTime';
import { addOutcomes, addPosition, createDraftBet, publishBet } from '../lib/queries/bets';

const STEPS = [
  { title: "What's the bet?", validate: isTitleStepValid, Component: TitleStep },
  {
    title: 'Outcomes',
    subtitle: '2 to 8 of them.',
    validate: isOutcomesStepValid,
    Component: OutcomesStep,
  },
  { title: 'When do entries close?', validate: isLockTimeStepValid, Component: LockTimeStep },
  { title: 'Who can see this?', validate: isVisibilityStepValid, Component: VisibilityStep },
  {
    title: "How's it settled?",
    subtitle: 'How you decide who won.',
    validate: isResolutionMethodStepValid,
    Component: ResolutionMethodStep,
  },
  { title: 'Review', validate: isReviewStepValid, Component: ReviewStep },
] as const;

export default function NewBet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<NewBetDraft>(EMPTY_DRAFT);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  function patchDraft(patch: Partial<NewBetDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function goBack() {
    if (stepIndex === 0) {
      navigate('/');
      return;
    }
    setStepIndex((s) => s - 1);
  }

  async function handlePublish() {
    if (!user || draft.stakeOutcomeIndex === null || !draft.stakeKind || !draft.lockOption) return;
    const locksAt = resolveLocksAt(draft.lockOption, draft.customLocksAt);
    if (!locksAt || !draft.visibility) return;

    setPublishing(true);
    setPublishError(null);
    try {
      const bet = await createDraftBet({
        title: draft.title.trim(),
        visibility: draft.visibility,
        resolutionMethod: draft.resolutionMethod,
        locksAt: locksAt.toISOString(),
        creatorId: user.id,
      });

      const outcomeLabels = draft.outcomes.map((o) => o.trim());
      const outcomes = await addOutcomes(bet.id, outcomeLabels);

      await publishBet(bet.id);

      const chosenOutcome = outcomes[draft.stakeOutcomeIndex];
      await addPosition({
        betId: bet.id,
        userId: user.id,
        outcomeId: chosenOutcome.id,
        stakeKind: draft.stakeKind,
        stakeLabel: draft.stakeLabel.trim(),
      });

      clearDraft();
      navigate(`/bet/${bet.id}`, { replace: true });
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Could not publish. Try again.');
      setPublishing(false);
    }
  }

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const valid = step.validate(draft);

  return (
    <WizardShell
      step={stepIndex}
      total={STEPS.length}
      title={step.title}
      subtitle={'subtitle' in step ? step.subtitle : undefined}
      onBack={goBack}
      footer={
        <div className="flex flex-col gap-2">
          {publishError && <p className="text-sm text-red-600 dark:text-red-400">{publishError}</p>}
          <Button
            disabled={!valid || publishing}
            onClick={() => {
              if (isLastStep) {
                void handlePublish();
              } else {
                setStepIndex((s) => s + 1);
              }
            }}
          >
            {isLastStep ? (publishing ? 'Publishing…' : 'Publish') : 'Next'}
          </Button>
        </div>
      }
    >
      <step.Component draft={draft} onChange={patchDraft} />
    </WizardShell>
  );
}
