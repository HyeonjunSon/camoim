import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10 w-48 rounded-control" />
      <div className="mt-4 flex gap-2">
        <SkeletonBlock className="h-9 w-20 rounded-pill" />
        <SkeletonBlock className="h-9 w-20 rounded-pill" />
        <SkeletonBlock className="h-9 w-24 rounded-pill" />
      </div>
      <SkeletonBlock className="mt-5 h-96" />
    </SkeletonPage>
  );
}
