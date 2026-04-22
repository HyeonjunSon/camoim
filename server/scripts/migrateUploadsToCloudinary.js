/**
 * 레거시 로컬 업로드 파일(server/uploads/*)을 Cloudinary로 옮기고
 * DB의 /uploads/... URL을 Cloudinary secure_url로 업데이트한다.
 *
 * 멱등: 이미 마이그레이션된 레코드(URL이 http로 시작)는 스킵.
 * 파일이 로컬에 없으면 해당 항목은 건너뛰고 경고만 출력.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function isLegacy(url) {
  return typeof url === 'string' && url.startsWith('/uploads/');
}

async function uploadOne(relativeUrl, folder) {
  const filename = relativeUrl.replace(/^\/uploads\//, '');
  const localPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(localPath)) {
    console.warn(`  ⚠️  파일 없음: ${localPath}`);
    return null;
  }
  const res = await cloudinary.uploader.upload(localPath, {
    folder,
    resource_type: 'auto',
    use_filename: true,
    unique_filename: true,
  });
  return res.secure_url;
}

async function migratePosts() {
  const Post = require('../models/Post');
  const posts = await Post.find({
    $or: [
      { images: { $regex: '^/uploads/' } },
      { thumbnail: { $regex: '^/uploads/' } },
    ],
  });

  console.log(`\n📝 posts: ${posts.length}건`);
  let ok = 0, skip = 0, fail = 0;

  for (const post of posts) {
    try {
      let changed = false;

      if (Array.isArray(post.images)) {
        const newImages = [];
        for (const img of post.images) {
          if (!isLegacy(img)) { newImages.push(img); continue; }
          const newUrl = await uploadOne(img, 'camoim/posts');
          if (newUrl) { newImages.push(newUrl); changed = true; }
          else newImages.push(img); // 파일 없으면 원본 유지
        }
        post.images = newImages;
      }

      if (isLegacy(post.thumbnail)) {
        const newUrl = await uploadOne(post.thumbnail, 'camoim/posts');
        if (newUrl) { post.thumbnail = newUrl; changed = true; }
      }

      if (changed) {
        await post.save();
        console.log(`  ✅ post ${post._id} 업데이트`);
        ok++;
      } else {
        skip++;
      }
    } catch (e) {
      console.error(`  ❌ post ${post._id} 실패:`, e.message);
      fail++;
    }
  }
  console.log(`  결과: ok=${ok} skip=${skip} fail=${fail}`);
}

async function migrateVerify() {
  const VerifyRequest = require('../models/VerifyRequest');
  const reqs = await VerifyRequest.find({ fileUrl: { $regex: '^/uploads/' } });

  console.log(`\n🎓 verify requests: ${reqs.length}건`);
  let ok = 0, fail = 0;

  for (const r of reqs) {
    try {
      const newUrl = await uploadOne(r.fileUrl, 'camoim/verify');
      if (newUrl) {
        r.fileUrl = newUrl;
        await r.save();
        console.log(`  ✅ verify ${r._id} (${r.status}) 업데이트`);
        ok++;
      } else {
        fail++;
      }
    } catch (e) {
      console.error(`  ❌ verify ${r._id} 실패:`, e.message);
      fail++;
    }
  }
  console.log(`  결과: ok=${ok} fail=${fail}`);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI 없음');
    process.exit(1);
  }
  if (!process.env.CLOUDINARY_API_KEY) {
    console.error('CLOUDINARY_* 환경변수 없음');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo 연결');

  await migratePosts();
  await migrateVerify();

  await mongoose.disconnect();
  console.log('\n🎉 마이그레이션 완료');
})().catch(e => {
  console.error('치명적 오류:', e);
  process.exit(1);
});
