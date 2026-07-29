import type { ReactNode } from 'react';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
};

export function WizardShell({ step, total, title, subtitle, onBack, children, footer }: Props) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent-600' : 'bg-neutral-200 dark:bg-neutral-800'}`}
            />
          ))}
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        {title}
      </h1>
      {subtitle && <p className="mb-6 text-neutral-500 dark:text-neutral-400">{subtitle}</p>}

      <div className="flex-1">{children}</div>

      <div className="mt-8">{footer}</div>
    </div>
  );
}
