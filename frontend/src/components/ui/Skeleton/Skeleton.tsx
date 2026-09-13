// frontend/src/components/ui/Skeleton/Skeleton.tsx

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-border ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  return <Skeleton className={`${sizeClass} rounded-full`} />;
}

export function SkeletonPostCard() {
  return (
    <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2 w-24" />
        </div>
      </div>
      {/* Content */}
      <SkeletonText lines={3} />
      {/* Actions */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-6 w-12" />
      </div>
    </div>
  );
}

export function SkeletonWidget() {
  return (
    <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 sm:p-5">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      {/* Items */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <SkeletonAvatar size="sm" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-bg overflow-hidden">
          <Skeleton className="aspect-video rounded-none" />
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <SkeletonAvatar size="sm" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2 w-14" />
              </div>
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3.5">
          <SkeletonAvatar />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}