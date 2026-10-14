import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="mt-5 h-64" />
    </SkeletonPage>
  );
}
