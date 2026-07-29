export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800 ${className}`}
      aria-hidden="true"
    />
  );
}

export function BetCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function BetDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8" role="status" aria-label="Loading challenge">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-7 w-5/6" />
      <Skeleton className="mt-3 h-3 w-1/2" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}
