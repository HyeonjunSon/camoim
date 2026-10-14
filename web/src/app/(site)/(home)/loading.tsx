import { SkeletonBlock, SkeletonPage } from '@/components/Skeleton';

/**
 * Scoped to this page alone by the route group around it. A loading.tsx sitting directly in the parent segment would also cover the detail routes below, whose notFound() has to keep answering 404 — a boundary makes it 200.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex flex-wrap items-start gap-6 pb-16">
        <SkeletonBlock className="h-[420px] w-full flex-[1_1_210px] lg:max-w-[240px]" />
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <SkeletonBlock className="h-14" />
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-72" />
        </div>
        <div className="flex w-full flex-[1_1_280px] flex-col gap-4 lg:max-w-[320px]">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      </div>
    </SkeletonPage>
  );
}
