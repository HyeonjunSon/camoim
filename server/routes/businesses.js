// Korean business map — list, detail, submission, bookmark, report (user-facing)
// Admin approve/edit/delete lives in routes/admin.js (/api/admin/businesses)
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Business = require('../models/Business');
const BusinessBookmark = require('../models/BusinessBookmark');
const BusinessReview = require('../models/BusinessReview');
const BusinessWeeklyStat = require('../models/BusinessWeeklyStat');
const Report = require('../models/Report');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { geocodeAddress } = require('../utils/geocode');

const router = express.Router();

// Cloudinary — folder reserved for business photos
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

// Business report reasons mapped onto the Report schema enum (the human-readable label goes in detail)
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
    ratingAvg: b.ratingAvg || 0,
    ratingCount: b.ratingCount || 0,
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
// Approved businesses only. With near, compute distanceKm and sort nearest first
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

// ── GET /api/businesses/trending?city= ── top 5 by views this week (⚠️ must be declared before '/:id')
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const week = BusinessWeeklyStat.currentWeekKey();
    const stats = await BusinessWeeklyStat.find({ week }).sort({ views: -1 }).limit(50).lean();
    if (!stats.length) return res.json({ success: true, data: [] });

    const filter = { _id: { $in: stats.map((s) => s.businessId) }, status: 'approved' };
    if (req.query.city) filter.city = req.query.city;
    const list = await Business.find(filter).lean();

    const viewsOf = new Map(stats.map((s) => [String(s.businessId), s.views]));
    const bmSet = await bookmarkedSetFor(req.user?.id);
    const ranked = list
      .sort((a, b) => (viewsOf.get(String(b._id)) || 0) - (viewsOf.get(String(a._id)) || 0))
      .slice(0, 5)
      .map((b, i) => ({ ...formatBusiness(b, bmSet), rank: i + 1, weeklyViews: viewsOf.get(String(b._id)) || 0 }));
    res.json({ success: true, data: ranked, week });
  } catch (err) {
    console.error('GET /businesses/trending', err);
    res.status(500).json({ success: false, message: '인기 업체를 불러오지 못했습니다.' });
  }
});

// ── Recompute the review rollup into Business.ratingAvg / ratingCount ──
async function recomputeRating(businessId) {
  const [agg] = await BusinessReview.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Business.updateOne(
    { _id: businessId },
    { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.count : 0 }
  );
}

function formatReview(r, userId) {
  return {
    id: r._id,
    rating: r.rating,
    text: r.text || '',
    nickname: r.nickname || '익명',
    createdAt: r.createdAt,
    mine: userId ? String(r.userId) === String(userId) : false,
  };
}

// ── GET /api/businesses/:id/reviews ── review list (50 newest)
router.get('/:id/reviews', optionalAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    const list = await BusinessReview.find({ businessId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data: list.map((r) => formatReview(r, req.user?.id)) });
  } catch (err) {
    console.error('GET /businesses/:id/reviews', err);
    res.status(500).json({ success: false, message: '리뷰를 불러오지 못했습니다.' });
  }
});

// ── POST /api/businesses/:id/reviews ── create or edit a review (one per user, upsert)
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    const biz = await Business.findById(req.params.id).select('_id status').lean();
    if (!biz || biz.status !== 'approved') return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });

    const rating = Math.round(Number(req.body.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: '별점을 선택해주세요.' });
    }
    const text = String(req.body.text || '').trim().slice(0, 300);

    const review = await BusinessReview.findOneAndUpdate(
      { businessId: biz._id, userId: req.user.id },
      { rating, text, nickname: req.user.nickname || '' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await recomputeRating(biz._id);
    const fresh = await Business.findById(biz._id).select('ratingAvg ratingCount').lean();
    res.json({
      success: true,
      data: formatReview(review, req.user.id),
      ratingAvg: fresh?.ratingAvg || 0,
      ratingCount: fresh?.ratingCount || 0,
    });
  } catch (err) {
    console.error('POST /businesses/:id/reviews', err);
    res.status(500).json({ success: false, message: '리뷰 저장에 실패했습니다.' });
  }
});

// ── DELETE /api/businesses/:id/reviews ── delete my review
router.delete('/:id/reviews', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없습니다.' });
    await BusinessReview.deleteOne({ businessId: req.params.id, userId: req.user.id });
    await recomputeRating(req.params.id);
    const fresh = await Business.findById(req.params.id).select('ratingAvg ratingCount').lean();
    res.json({ success: true, ratingAvg: fresh?.ratingAvg || 0, ratingCount: fresh?.ratingCount || 0 });
  } catch (err) {
    console.error('DELETE /businesses/:id/reviews', err);
    res.status(500).json({ success: false, message: '리뷰 삭제에 실패했습니다.' });
  }
});

// ── POST /api/businesses/:id/reviews/:reviewId/report ── report a review (UGC policy)
router.post('/:id/reviews/:reviewId/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.reviewId)) return res.status(404).json({ success: false, message: '리뷰를 찾을 수 없습니다.' });
    const review = await BusinessReview.findById(req.params.reviewId).lean();
    if (!review) return res.status(404).json({ success: false, message: '리뷰를 찾을 수 없습니다.' });
    try {
      await Report.create({
        reporterId: req.user.id,
        targetType: 'review',
        targetId: review._id,
        targetAuthorId: review.userId,
        targetAuthorNickname: review.nickname || '',
        reason: 'etc',
        detail: `업체 리뷰 신고: "${(review.text || '').slice(0, 80)}"`,
      });
    } catch (e) {
      if (e.code !== 11000) throw e; // A duplicate report succeeds quietly
    }
    res.json({ success: true, message: '신고가 접수되었어요.' });
  } catch (err) {
    console.error('POST /businesses/:id/reviews/:reviewId/report', err);
    res.status(500).json({ success: false, message: '신고에 실패했습니다.' });
  }
});

// ── POST /api/businesses/upload-image ── upload a business photo and return its URL
router.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '이미지가 없습니다.' });
  res.json({ success: true, url: req.file.path });
});

// ── POST /api/businesses ── user submission (status=pending). Admins are approved immediately
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

    // Address to coordinates, best effort. The save proceeds even if it fails
    const geo = await geocodeAddress(doc.address, city);
    if (geo) doc.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };

    const created = await Business.create(doc);
    res.status(201).json({ success: true, data: formatBusiness(created, null) });
  } catch (err) {
    console.error('POST /businesses', err);
    res.status(500).json({ success: false, message: '제보에 실패했습니다.' });
  }
});

// ── GET /api/businesses/:id ── detail (approved, own submission, or admin)
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

    // Bump the weekly view count for the trending ranking — a failure must not affect the response
    if (b.status === 'approved') {
      BusinessWeeklyStat.updateOne(
        { businessId: b._id, week: BusinessWeeklyStat.currentWeekKey() },
        { $inc: { views: 1 } },
        { upsert: true }
      ).catch(() => {});
    }

    const bmSet = await bookmarkedSetFor(req.user?.id);
    res.json({ success: true, data: formatBusiness(b, bmSet) });
  } catch (err) {
    console.error('GET /businesses/:id', err);
    res.status(500).json({ success: false, message: '업체 정보를 불러오지 못했습니다.' });
  }
});

// ── POST /api/businesses/:id/bookmark ── toggle the bookmark
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
        if (e.code === 11000) bookmarked = true; // Concurrent duplicate — treat it as already bookmarked
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

// ── POST /api/businesses/:id/report ── report a problem (closed, wrong info, spam)
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
      if (e.code !== 11000) throw e; // A duplicate report succeeds quietly
    }
    res.json({ success: true, message: '신고가 접수되었어요.' });
  } catch (err) {
    console.error('POST /businesses/:id/report', err);
    res.status(500).json({ success: false, message: '신고에 실패했습니다.' });
  }
});

module.exports = router;
