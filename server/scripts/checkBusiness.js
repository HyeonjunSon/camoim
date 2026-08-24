// One-off: inspect a submitted business (location / submitter / map-readiness)
require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const q = process.argv[2] || 'whatasign';
  const list = await Business.find({ name: new RegExp(q, 'i') }).lean();
  if (!list.length) {
    console.log(`No business matching /${q}/i`);
    process.exit(0);
  }
  for (const b of list) {
    console.log('==============================================');
    console.log('id         :', String(b._id));
    console.log('name       :', b.name);
    console.log('category   :', b.category);
    console.log('city       :', b.city);
    console.log('address    :', b.address);
    console.log('phone      :', b.phone || '(none)');
    console.log('hours      :', b.hours || '(none)');
    console.log('desc       :', (b.description || '(none)').slice(0, 200));
    console.log('images     :', (b.images || []).length, 'img');
    console.log('source     :', b.source);
    console.log('status     :', b.status, b.status === 'pending' ? '  <-- 승인 대기' : '');
    console.log('location   :', b.location ? JSON.stringify(b.location) : '(none) <-- 지도 핀 안뜸');
    if (b.location?.coordinates?.length === 2) {
      const [lng, lat] = b.location.coordinates;
      console.log('  -> lat/lng:', lat, lng, `  https://maps.google.com/?q=${lat},${lng}`);
    }
    console.log('submittedBy:', String(b.submittedBy || '(null)'));
    console.log('submitter# :', b.submitterNickname || '(none)');
    if (b.submittedBy) {
      const u = await User.findById(b.submittedBy).lean();
      if (u) {
        console.log('  user     :', u.nickname, '/', u.email, '/ verified:', u.verified,
                    '/ role:', u.role, '/ univ:', u.university || '-');
      } else {
        console.log('  user     : (deleted / not found)');
      }
    }
    console.log('createdAt  :', b.createdAt);
    console.log('updatedAt  :', b.updatedAt);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
