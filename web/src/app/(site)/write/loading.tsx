import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10 w-28 rounded-control" />
      <SkeletonBlock className="mt-6 h-[520px]" />
    </SkeletonPage>
  );
}
