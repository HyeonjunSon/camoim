import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_POLICY, PRIVACY_VERSION } from '@/lib/legal';

export const metadata: Metadata = { title: '개인정보처리방침' };

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="개인정보처리방침"
      version={PRIVACY_VERSION}
      effectiveDate={PRIVACY_EFFECTIVE_DATE}
      body={PRIVACY_POLICY}
    />
  );
}
