import type { ReactNode } from 'react';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-6 py-12">
      {children}
    </div>
  );
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
      {children}
    </h1>
  );
}

export function ScreenSubtitle({ children }: { children: ReactNode }) {
  return <p className="mb-8 text-base text-neutral-500 dark:text-neutral-400">{children}</p>;
}
