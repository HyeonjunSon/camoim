import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10 w-32 rounded-control" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>
    </SkeletonPage>
  );
}
