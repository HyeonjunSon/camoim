// 숙소 지도 — 목록/상세/등록/수정/즐겨찾기/신고 (유저용 마켓플레이스)
// 프라이버시: 정확 주소·정확 좌표는 절대 응답에 넣지 않음 (approx만 노출).
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const StayListing = require('../models/StayListing');
const StayBookmark = require('../models/StayBookmark');
const Report = require('../models/Report');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { geocodeAddress } = require('../utils/geocode');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/stays',
    allowed_formats: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const { STAY_TYPES, STAY_CITIES, STAY_CONDITIONS } = StayListing;

const REPORT_REASONS = {
  taken:  { reason: 'etc',  label: '이미 나간 방이에요' },
  info:   { reason: 'etc',  label: '정보가 사실과 달라요' },
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

// ⚠️ address / location(정확좌표)는 절대 노출하지 않음. approxLocation만 lat/lng로.
function formatStay(s, bookmarkedSet, viewer) {
  const coords = s.approxLocation?.coordinates;
  const host = s.host && typeof s.host === 'object' ? s.host : null;
  return {
    id: s._id,
    title: s.title,
    stayType: s.stayType,
    city: s.city,
    price: s.price,
    deposit: s.deposit || 0,
    conditions: Array.isArray(s.conditions) ? s.conditions : [],
    description: s.description || '',
    images: s.images || [],
    lat: Array.isArray(coords) ? coords[1] : null,
    lng: Array.isArray(coords) ? coords[0] : null,
    neighborhood: s.neighborhood || '',
    moveInDate: s.moveInDate || '',
    minLeaseMonths: s.minLeaseMonths || 0,
    includes: s.includes || '',
    host: host
      ? { id: host._id, nickname: host.nickname || s.hostNickname || '', verified: !!host.verified }
      : { id: s.host, nickname: s.hostNickname || '', verified: false },
    isMine: viewer ? String(s.host?._id || s.host) === String(viewer) : false,
    status: s.status,
    bookmarkCount: s.bookmarkCount || 0,
    reportCount: s.reportCount || 0,
    createdAt: s.createdAt,
    bookmarked: bookmarkedSet ? bookmarkedSet.has(String(s._id)) : false,
  };
}

async function bookmarkedSetFor(userId) {
  if (!userId) return null;
  const bms = await StayBookmark.find({ userId }).select('stayId').lean();
  return new Set(bms.map((b) => String(b.stayId)));
}

function sanitizeConditions(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((c) => STAY_CONDITIONS.includes(c)).slice(0, 12);
}

// ── GET /api/stays?city=&type=&near=lng,lat ── 활성 숙소 (approx 좌표만) ──
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { city, type, near } = req.query;
    const filter = { status: 'active' };
    if (city) filter.city = city;
    if (type && STAY_TYPES.includes(type)) filter.stayType = type;

    const list = await StayListing.find(filter)
      .sort({ createdAt: -1 }).limit(1000)
      .populate('host', 'nickname verified').lean();
    const bmSet = await bookmarkedSetFor(req.user?.id);
    let formatted = list.map((s) => formatStay(s, bmSet, req.user?.id));

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
    console.error('GET /stays', err);
    res.status(500).json({ success: false, message: '숙소 목록을 불러오지 못했습니다.' });
  }
});

// ── GET /api/stays/mine ── 내가 올린 숙소 (관리/수정용) ──
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const list = await StayListing.find({ host: req.user.id })
      .sort({ createdAt: -1 }).populate('host', 'nickname verified').lean();
    res.json({ success: true, data: list.map((s) => formatStay(s, null, req.user.id)) });
  } catch (err) {
    console.error('GET /stays/mine', err);
    res.status(500).json({ success: false, message: '내 숙소를 불러오지 못했습니다.' });
  }
});

router.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '이미지가 없습니다.' });
  res.json({ success: true, url: req.file.path });
});

// ── POST /api/stays ── 숙소 등록 (호스트 = 본인) ──
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, stayType, city, address } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: '숙소 이름을 입력해주세요.' });
    if (!STAY_TYPES.includes(stayType)) return res.status(400).json({ success: false, message: '숙소 유형을 선택해주세요.' });
    if (!STAY_CITIES.includes(city)) return res.status(400).json({ success: false, message: '도시를 선택해주세요.' });
    if (!address || !address.trim()) return res.status(400).json({ success: false, message: '주소를 입력해주세요.' });
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: '월세를 입력해주세요.' });

    const images = Array.isArray(req.body.images) ? req.body.images.filter((u) => typeof u === 'string').slice(0, 8) : [];
    const doc = {
      title: title.trim(),
      stayType,
      city,
      price,
      deposit: Number.isFinite(Number(req.body.deposit)) ? Math.max(0, Number(req.body.deposit)) : 0,
      conditions: sanitizeConditions(req.body.conditions),
      description: (req.body.description || '').trim(),
      images,
      address: address.trim(),
      neighborhood: (req.body.neighborhood || '').trim(),
      moveInDate: (req.body.moveInDate || '').trim(),
      minLeaseMonths: Number.isFinite(Number(req.body.minLeaseMonths)) ? Math.max(0, Number(req.body.minLeaseMonths)) : 0,
      includes: (req.body.includes || '').trim(),
      host: req.user.id,
      hostNickname: req.user.nickname || '',
      status: 'active',
    };
    // roomrent 글에서 온 경우 원본 글 연결 (입주완료 동기화용)
    if (req.body.sourcePostId && mongoose.isValidObjectId(req.body.sourcePostId)) {
      doc.sourcePostId = req.body.sourcePostId;
    }

    // 주소 → 정확 좌표(서버 전용) → 대략 좌표(노출용). 실패해도 저장은 진행 (지도 핀만 안 뜸)
    const geo = await geocodeAddress(doc.address, city);
    if (geo) {
      doc.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
      doc.approxLocation = { type: 'Point', coordinates: StayListing.jitter(geo.lng, geo.lat) };
    }

    const created = await StayListing.create(doc);
    const full = await StayListing.findById(created._id).populate('host', 'nickname verified').lean();
    res.status(201).json({ success: true, data: formatStay(full, null, req.user.id), located: !!geo });
  } catch (err) {
    console.error('POST /stays', err);
    res.status(500).json({ success: false, message: '숙소 등록에 실패했습니다.' });
  }
});

// ── GET /api/stays/:id ── 상세 (정확 주소는 여전히 비노출) ──
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    const s = await StayListing.findById(req.params.id).populate('host', 'nickname verified').lean();
    if (!s) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });

    const isOwner = req.user && String(s.host?._id || s.host) === String(req.user.id);
    if (s.status !== 'active' && !isOwner && req.user?.role !== 'admin') {
      return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    }

    const bmSet = await bookmarkedSetFor(req.user?.id);
    res.json({ success: true, data: formatStay(s, bmSet, req.user?.id) });
  } catch (err) {
    console.error('GET /stays/:id', err);
    res.status(500).json({ success: false, message: '숙소 정보를 불러오지 못했습니다.' });
  }
});

// ── PUT /api/stays/:id ── 수정 (호스트 본인만) ──
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    const s = await StayListing.findById(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    if (String(s.host) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
    }

    const b = req.body;
    if (b.title != null) s.title = String(b.title).trim().slice(0, 100);
    if (STAY_TYPES.includes(b.stayType)) s.stayType = b.stayType;
    if (Number.isFinite(Number(b.price))) s.price = Math.max(0, Number(b.price));
    if (Number.isFinite(Number(b.deposit))) s.deposit = Math.max(0, Number(b.deposit));
    if (b.conditions != null) s.conditions = sanitizeConditions(b.conditions);
    if (b.description != null) s.description = String(b.description).trim().slice(0, 2000);
    if (Array.isArray(b.images)) s.images = b.images.filter((u) => typeof u === 'string').slice(0, 8);
    if (b.neighborhood != null) s.neighborhood = String(b.neighborhood).trim().slice(0, 80);
    if (b.moveInDate != null) s.moveInDate = String(b.moveInDate).trim().slice(0, 40);
    if (Number.isFinite(Number(b.minLeaseMonths))) s.minLeaseMonths = Math.max(0, Number(b.minLeaseMonths));
    if (b.includes != null) s.includes = String(b.includes).trim().slice(0, 200);

    // 주소 변경 시에만 재지오코딩 (정확+대략 갱신)
    if (b.address != null && String(b.address).trim() && String(b.address).trim() !== s.address) {
      s.address = String(b.address).trim().slice(0, 200);
      const geo = await geocodeAddress(s.address, s.city);
      if (geo) {
        s.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
        s.approxLocation = { type: 'Point', coordinates: StayListing.jitter(geo.lng, geo.lat) };
      }
    }

    await s.save();
    const full = await StayListing.findById(s._id).populate('host', 'nickname verified').lean();
    res.json({ success: true, data: formatStay(full, null, req.user.id) });
  } catch (err) {
    console.error('PUT /stays/:id', err);
    res.status(500).json({ success: false, message: '숙소 수정에 실패했습니다.' });
  }
});

// ── PUT /api/stays/:id/status ── 입주가능/입주완료 토글 (호스트 본인) ──
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    const s = await StayListing.findById(req.params.id).select('host status');
    if (!s) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    if (String(s.host) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }
    const next = req.body.status === 'closed' ? 'closed' : 'active';
    s.status = next;
    await s.save();
    res.json({ success: true, status: next });
  } catch (err) {
    console.error('PUT /stays/:id/status', err);
    res.status(500).json({ success: false, message: '상태 변경에 실패했습니다.' });
  }
});

// ── DELETE /api/stays/:id ── 삭제 (호스트 본인 또는 관리자) ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    const s = await StayListing.findById(req.params.id).select('host');
    if (!s) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    if (String(s.host) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }
    await StayBookmark.deleteMany({ stayId: s._id });
    await Report.deleteMany({ targetType: 'stay', targetId: s._id });
    await s.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /stays/:id', err);
    res.status(500).json({ success: false, message: '숙소 삭제에 실패했습니다.' });
  }
});

// ── POST /api/stays/:id/bookmark ── 즐겨찾기 토글 ──
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    const stay = await StayListing.findById(req.params.id).select('_id').lean();
    if (!stay) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });

    const existing = await StayBookmark.findOne({ userId: req.user.id, stayId: stay._id });
    let bookmarked;
    if (existing) {
      await existing.deleteOne();
      await StayListing.updateOne({ _id: stay._id }, { $inc: { bookmarkCount: -1 } });
      bookmarked = false;
    } else {
      try {
        await StayBookmark.create({ userId: req.user.id, stayId: stay._id });
        await StayListing.updateOne({ _id: stay._id }, { $inc: { bookmarkCount: 1 } });
        bookmarked = true;
      } catch (e) {
        if (e.code === 11000) bookmarked = true;
        else throw e;
      }
    }
    const fresh = await StayListing.findById(stay._id).select('bookmarkCount').lean();
    res.json({ success: true, bookmarked, bookmarkCount: Math.max(0, fresh?.bookmarkCount || 0) });
  } catch (err) {
    console.error('POST /stays/:id/bookmark', err);
    res.status(500).json({ success: false, message: '즐겨찾기 처리에 실패했습니다.' });
  }
});

// ── POST /api/stays/:id/report ── 신고 ──
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
    const stay = await StayListing.findById(req.params.id).select('_id').lean();
    if (!stay) return res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });

    const mapped = REPORT_REASONS[req.body.reason] || REPORT_REASONS.info;
    try {
      await Report.create({
        reporterId: req.user.id,
        targetType: 'stay',
        targetId: stay._id,
        reason: mapped.reason,
        detail: mapped.label,
      });
      await StayListing.updateOne({ _id: stay._id }, { $inc: { reportCount: 1 } });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
    res.json({ success: true, message: '신고가 접수되었어요.' });
  } catch (err) {
    console.error('POST /stays/:id/report', err);
    res.status(500).json({ success: false, message: '신고에 실패했습니다.' });
  }
});

module.exports = router;
