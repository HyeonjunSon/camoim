const express = require('express');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const VerifyRequest = require('../models/VerifyRequest');
const { requireAuth } = require('../middleware/auth');
const University = require('../models/University');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// School verification documents go to Cloudinary (private folder, hard-to-guess public_id)
const verifyStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/verify',
    resource_type: 'auto', // jpg, png and pdf are all accepted
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'heic', 'heif'],
  },
});
const upload = multer({
  storage: verifyStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf', '.heic', '.heif'];
    const allowedMimes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype?.toLowerCase();
    if (allowedExts.includes(ext) || allowedMimes.includes(mime)) cb(null, true);
    else cb(new Error('jpg, png, pdf 파일만 업로드 가능합니다.'));
  },
});

// POST /api/verify/apply — submit a verification request
router.post('/apply', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '서류 파일을 첨부해주세요.' });
    }

    const { university, studentType, graduationYear } = req.body;

    if (!university || !studentType) {
      return res.status(400).json({ success: false, message: '학교와 재학/졸업 구분을 선택해주세요.' });
    }

    const validUniversity = await University.findOne({
      active: true,
      $or: [{ name: university }, { fullName: university }],
    }).lean();
    if (!validUniversity) {
      return res.status(400).json({ success: false, message: '지원하지 않는 학교입니다.' });
    }

    if (studentType === 'alumni' && !graduationYear) {
      return res.status(400).json({ success: false, message: '졸업연도를 입력해주세요.' });
    }

    // Only a pending request blocks a duplicate (an approved one still allows a transfer or school change)
    const pendingExisting = await VerifyRequest.findOne({
      userId: req.user.id,
      status: 'pending',
    });
    if (pendingExisting) {
      return res.status(409).json({
        success: false,
        message: '이미 심사 중인 신청이 있습니다.',
      });
    }

    // multer-storage-cloudinary puts the Cloudinary URL on req.file.path
    const fileUrl = req.file.path;

    await VerifyRequest.create({
      userId: req.user.id,
      university: validUniversity.shortName,
      studentType,
      graduationYear: studentType === 'alumni' ? Number(graduationYear) : null,
      fileUrl,
    });

    res.status(201).json({ success: true, data: { message: '신청이 접수됐어요. 관리자 검토 후 알림을 드릴게요.' } });
  } catch (err) {
    console.error('인증 신청 오류:', err);
    res.status(500).json({ success: false, message: err.message || '서버 오류가 발생했습니다.' });
  }
});

// GET /api/verify/status — my verification request status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const request = await VerifyRequest.findOne({ userId: req.user.id })
      .sort({ createdAt: -1 });

    if (!request) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        id: request._id,
        university: request.university,
        studentType: request.studentType,
        graduationYear: request.graduationYear,
        status: request.status,
        adminNote: request.adminNote,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
