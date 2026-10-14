import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10 w-32 rounded-control" />
      <SkeletonBlock className="mt-5 h-80" />
    </SkeletonPage>
  );
}
