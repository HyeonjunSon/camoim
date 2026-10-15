import type { Metadata } from 'next';
import SettingsPanels from '@/components/admin/SettingsPanels';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminSettings } from '@/lib/types';

export const metadata: Metadata = {
  title: '시스템 설정',
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const settings = await apiFetchOrNull<AdminSettings>('/admin/settings');

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">시스템 설정</h1>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
        여기서 바꾼 값은 앱과 웹 양쪽에 바로 적용돼요. 점검 모드와 강제 업데이트는 서비스를 멈출 수
        있으니 저장 전에 한 번 더 확인해주세요.
      </p>

      <div className="mt-6">
        {settings ? (
          <SettingsPanels settings={settings} />
        ) : (
          <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
            설정을 불러오지 못했어요.
          </p>
        )}
      </div>
    </main>
  );
}
