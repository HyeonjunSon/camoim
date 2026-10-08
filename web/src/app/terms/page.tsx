import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { TERMS_EFFECTIVE_DATE, TERMS_OF_SERVICE, TERMS_VERSION } from '@/lib/legal';

export const metadata: Metadata = { title: '이용약관' };

export default function TermsPage() {
  return (
    <LegalDocument
      title="이용약관"
      version={TERMS_VERSION}
      effectiveDate={TERMS_EFFECTIVE_DATE}
      body={TERMS_OF_SERVICE}
    />
  );
}
