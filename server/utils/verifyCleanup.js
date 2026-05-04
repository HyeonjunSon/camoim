// 학교 인증 서류 90일 자동 삭제 — 개인정보처리방침 ("인증 완료 후 90일 이내 파기") 준수
const { v2: cloudinary } = require('cloudinary');
const VerifyRequest = require('../models/VerifyRequest');

const RETENTION_DAYS = 90;
const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1일 1회

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary URL → public_id (확장자 제외, 폴더 포함)
// 예) https://res.cloudinary.com/camoim/image/upload/v123/camoim/verify/abc.jpg → camoim/verify/abc
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/upload\/(?:v\d+\/)?([^?#]+)$/);
  if (!m) return null;
  return m[1].replace(/\.[a-zA-Z0-9]+$/, '');
}

function detectResourceType(url) {
  if (!url) return 'image';
  if (/\.pdf(\?|$)/i.test(url)) return 'raw';
  if (/\/raw\/upload\//.test(url)) return 'raw';
  return 'image';
}

async function deleteCloudinaryFile(url) {
  const publicId = extractPublicId(url);
  if (!publicId) return false;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: detectResourceType(url),
      invalidate: true,
    });
    return true;
  } catch (e) {
    console.error('[verify-cleanup] cloudinary destroy failed:', publicId, e.message);
    return false;
  }
}

async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  // 승인/거절된 지 90일 지난 서류 — pending은 그대로 둠 (관리자 검토 대기 중)
  const stale = await VerifyRequest.find({
    status: { $in: ['approved', 'rejected'] },
    reviewedAt: { $lte: cutoff },
    fileUrl: { $exists: true, $ne: '' },
  }).select('_id fileUrl').lean();

  if (!stale.length) return { deleted: 0 };

  let deleted = 0;
  for (const r of stale) {
    await deleteCloudinaryFile(r.fileUrl);
    // DB 레코드는 삭제하지 않고 fileUrl만 비움 — 감사 추적용 (누가 인증됐는지 기록은 유지)
    await VerifyRequest.updateOne({ _id: r._id }, { $set: { fileUrl: '' } });
    deleted++;
  }
  console.log(`[verify-cleanup] purged ${deleted} verification document(s) older than ${RETENTION_DAYS} days`);
  return { deleted };
}

let timer = null;
function startVerifyCleanupJob() {
  if (timer) return;
  // 시작 시 30초 후 한 번 실행 (서버 부팅 시 즉시 정리)
  setTimeout(() => {
    runCleanup().catch((err) => console.error('[verify-cleanup] initial run failed:', err));
  }, 30 * 1000);
  // 이후 24시간마다
  timer = setInterval(() => {
    runCleanup().catch((err) => console.error('[verify-cleanup] scheduled run failed:', err));
  }, SCAN_INTERVAL_MS);
}

module.exports = { runCleanup, startVerifyCleanupJob, extractPublicId };
