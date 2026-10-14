import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

/**
 * This route has no children, so the boundary cannot leak into one.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-[70vh]" />
    </SkeletonPage>
  );
}
