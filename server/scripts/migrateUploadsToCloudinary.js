/**
 * Moves legacy local upload files (server/uploads/*) to Cloudinary and rewrites
 * the /uploads/... URLs in the DB to the Cloudinary secure_url.
 *
 * Idempotent: records already migrated (their URL starts with http) are skipped.
 * When the local file is missing, the entry is skipped with a warning.
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
    console.warn(`  ⚠️  file missing: ${localPath}`);
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

  console.log(`\n📝 posts: ${posts.length}`);
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
          else newImages.push(img); // Keep the original when the file is missing
        }
        post.images = newImages;
      }

      if (isLegacy(post.thumbnail)) {
        const newUrl = await uploadOne(post.thumbnail, 'camoim/posts');
        if (newUrl) { post.thumbnail = newUrl; changed = true; }
      }

      if (changed) {
        await post.save();
        console.log(`  ✅ post ${post._id} updated`);
        ok++;
      } else {
        skip++;
      }
    } catch (e) {
      console.error(`  ❌ post ${post._id} failed:`, e.message);
      fail++;
    }
  }
  console.log(`  result: ok=${ok} skip=${skip} fail=${fail}`);
}

async function migrateVerify() {
  const VerifyRequest = require('../models/VerifyRequest');
  const reqs = await VerifyRequest.find({ fileUrl: { $regex: '^/uploads/' } });

  console.log(`\n🎓 verify requests: ${reqs.length}`);
  let ok = 0, fail = 0;

  for (const r of reqs) {
    try {
      const newUrl = await uploadOne(r.fileUrl, 'camoim/verify');
      if (newUrl) {
        r.fileUrl = newUrl;
        await r.save();
        console.log(`  ✅ verify ${r._id} (${r.status}) updated`);
        ok++;
      } else {
        fail++;
      }
    } catch (e) {
      console.error(`  ❌ verify ${r._id} failed:`, e.message);
      fail++;
    }
  }
  console.log(`  result: ok=${ok} fail=${fail}`);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  if (!process.env.CLOUDINARY_API_KEY) {
    console.error('CLOUDINARY_* environment variables are not set');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ connected to Mongo');

  await migratePosts();
  await migrateVerify();

  await mongoose.disconnect();
  console.log('\n🎉 migration complete');
})().catch(e => {
  console.error('fatal error:', e);
  process.exit(1);
});
