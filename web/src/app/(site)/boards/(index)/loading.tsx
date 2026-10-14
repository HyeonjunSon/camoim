import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

/**
 * Scoped to this page alone by the route group around it. A loading.tsx sitting directly in the parent segment would also cover the detail routes below, whose notFound() has to keep answering 404 — a boundary makes it 200.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10 w-28 rounded-control" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>
    </SkeletonPage>
  );
}
