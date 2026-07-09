// 한인 업체 지도 — 목록/상세/제보/즐겨찾기/신고 (유저용)
// 관리자 승인/수정/삭제는 routes/admin.js 에 있음 (/api/admin/businesses)
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Business = require('../models/Business');
const BusinessBookmark = require('../models/BusinessBookmark');
const Report = require('../models/Report');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { geocodeAddress } = require('../utils/geocode');

const router = express.Router();

// Cloudinary — 업체 사진 전용 폴더
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/businesses',
    allowed_formats: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const CATEGORIES = Business.CATEGORIES;

// 업체 신고 사유 → Report 스키마 enum 매핑 (사람이 읽는 라벨은 detail에 저장)
const REPORT_REASONS = {
  closed: { reason: 'etc',  label: '폐업했어요' },
  info:   { reason: 'etc',  label: '주소·전화 등 정보가 달라요' },
  spam:   { reason: 'spam', label: '스팸·중복 등록이에요' },
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatBusiness(b, bookmarkedSet) {
  const coords = b.location?.coordinates;
  return {
    id: b._id,
    name: b.name,
    category: b.category,
    city: b.city,
    address: b.address,
    phone: b.phone || '',
    hours: b.hours || '',
    description: b.description || '',
    images: b.images || [],
    lat: Array.isArray(coords) ? coords[1] : null,
    lng: Array.isArray(coords) ? coords[0] : null,
    source: b.source,
    status: b.status,
    bookmarkCount: b.bookmarkCount || 0,
    submitterNickname: b.submitterNickname || '',
    sourceName: b.sourceName || '',
    createdAt: b.createdAt,
    bookmarked: bookmarkedSet ? bookmarkedSet.has(String(b._id)) : false,
  };
}

async function bookmarkedSetFor(userId) {
  if (!userId) return null;
  const bms = await BusinessBookmark.find({ userId }).select('businessId').lean();
  return new Set(bms.map((b) => String(b.businessId)));
}

// ── GET /api/businesses?city=&category=&near=lng,lat ──────────────
// 승인된 업체만. near 주어지면 거리(distanceKm) 계산 + 가까운 순 정렬
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { city, category, near } = req.query;
    const filter = { status: 'approved' };
    if (city) filter.city = city;
    if (category && CATEGORIES.includes(category)) filter.category = category;

    const list = await Business.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    const bmSet = await bookmarkedSetFor(req.user?.id);
    let formatted = list.map((b) => formatBusiness(b, bmSet));

    if (near) {
      const [lng, lat] = String(near).split(',').map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        formatted.forEach((f) => {
          f.distanceKm = f.lat != null && f.lng != null ? haversineKm(lat, lng, f.lat, f.lng) : null;
        });
        formatted.sort(
          (a, b) => (a.distanceKm == null ? Infinity : a.distanceKm) - (b.distanceKm == null ? Infinity : b.distanceKm)
        );
      }
    }

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('GET /businesses', err);
    res.status(500).json({ success: false, message: '업체 목록을 불러오지 못했습니다.' });
  }
});

// ── POST /api/businesses/upload-image ── 업체 사진 업로드 → URL 반환
router.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '이미지가 없습니다.' });
  res.json({ success: true, url: req.file.path });
});

// ── POST /api/businesses ── 유저 제보 (status=pending). 관리자면 즉시 승인
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, category, city, address, phone, hours, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: '업체명을 입력해주세요.' });
    if (!CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: '카테고리를 선택해주세요.' });
    if (!city) return res.status(400).json({ success: false, message: '도시를 선택해주세요.' });
    if (!address || !address.trim()) return res.status(400).json({ success: false, message: '주소를 입력해주세요.' });

    const images = Array.isArray(req.body.images) ? req.body.images.filter((u) => typeof u === 'string').slice(0, 5) : [];
    const isAdmin = req.user.role === 'admin';

    const doc = {
      name: name.trim(),
      category,
      city,
      address: address.trim(),
      phone: (phone || '').trim(),
      hours: (hours || '').trim(),
      description: (description || '').trim(),
      images,
      source: isAdmin ? 'admin' : 'user',
      status: isAdmin ? 'approved' : 'pending',
      submittedBy: req.user.id,
      submitterNickname: req.user.nickname || '',
    };

    // 주소 → 좌표 (best-effort). 실패해도 저장은 진행
    const geo = await geocodeAddress(doc.address, city);
    if (geo) doc.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };

    const created = await Business.create(doc);
    res.status(201).json({ success: true, data: formatBusiness(created, null) });
  } catch (err) {
    console.error('POST /businesses', err);
    res.status(500).json({ success: false, message: '제보에 실패했습니다.' });
  }
});

// ── GET /api/businesses/:id ── 상세 (승인 / 본인 제보 / 관리자만)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    const b = await Business.findById(req.params.id).lean();
    if (!b) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });

    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user && String(b.submittedBy) === String(req.user.id);
    if (b.status !== 'approved' && !isAdmin && !isOwner) {
      return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    }

    const bmSet = await bookmarkedSetFor(req.user?.id);
    res.json({ success: true, data: formatBusiness(b, bmSet) });
  } catch (err) {
    console.error('GET /businesses/:id', err);
    res.status(500).json({ success: false, message: '업체 정보를 불러오지 못했습니다.' });
  }
});

// ── POST /api/businesses/:id/bookmark ── 즐겨찾기 토글
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    const biz = await Business.findById(req.params.id).select('_id').lean();
    if (!biz) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });

    const existing = await BusinessBookmark.findOne({ userId: req.user.id, businessId: biz._id });
    let bookmarked;
    if (existing) {
      await existing.deleteOne();
      await Business.updateOne({ _id: biz._id }, { $inc: { bookmarkCount: -1 } });
      bookmarked = false;
    } else {
      try {
        await BusinessBookmark.create({ userId: req.user.id, businessId: biz._id });
        await Business.updateOne({ _id: biz._id }, { $inc: { bookmarkCount: 1 } });
        bookmarked = true;
      } catch (e) {
        if (e.code === 11000) bookmarked = true; // 동시요청 중복 — 이미 즐겨찾기 상태로 간주
        else throw e;
      }
    }
    const fresh = await Business.findById(biz._id).select('bookmarkCount').lean();
    res.json({ success: true, bookmarked, bookmarkCount: Math.max(0, fresh?.bookmarkCount || 0) });
  } catch (err) {
    console.error('POST /businesses/:id/bookmark', err);
    res.status(500).json({ success: false, message: '즐겨찾기 처리에 실패했습니다.' });
  }
});

// ── POST /api/businesses/:id/report ── 문제 신고 (폐업/정보변경/스팸)
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    const biz = await Business.findById(req.params.id).select('_id').lean();
    if (!biz) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });

    const mapped = REPORT_REASONS[req.body.reason] || REPORT_REASONS.info;
    try {
      await Report.create({
        reporterId: req.user.id,
        targetType: 'business',
        targetId: biz._id,
        reason: mapped.reason,
        detail: mapped.label,
      });
      await Business.updateOne({ _id: biz._id }, { $inc: { reportCount: 1 } });
    } catch (e) {
      if (e.code !== 11000) throw e; // 중복 신고는 조용히 성공 처리
    }
    res.json({ success: true, message: '신고가 접수되었어요.' });
  } catch (err) {
    console.error('POST /businesses/:id/report', err);
    res.status(500).json({ success: false, message: '신고에 실패했습니다.' });
  }
});

module.exports = router;
