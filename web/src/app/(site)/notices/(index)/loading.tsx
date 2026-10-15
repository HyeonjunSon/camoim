import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

/** Scoped by the route group so the detail route keeps its real 404. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10 w-32 rounded-control" />
      <SkeletonBlock className="mt-5 h-72" />
    </SkeletonPage>
  );
}
