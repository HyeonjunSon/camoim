// Delete businesses with no coordinates — except Whatasign, which has no address at all and is kept.
// Cascade: BusinessBookmark + Report (same as the admin DELETE route)
// Run: railway run node scripts/deleteCoordlessBusinesses.js
require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const BusinessBookmark = require('../models/BusinessBookmark');
const Report = require('../models/Report');

const KEEP = /whatasign/i; // Name patterns to preserve

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const coordless = await Business.find({
    $or: [
      { location: { $exists: false } },
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates': { $size: 0 } },
    ],
  }).lean();

  const toDelete = coordless.filter((b) => !KEEP.test(b.name || ''));
  const kept = coordless.filter((b) => KEEP.test(b.name || ''));

  console.log(`${coordless.length} businesses with no coordinates`);
  console.log(`keeping ${kept.length}: ${kept.map((b) => b.name).join(', ') || '(none)'}`);
  console.log(`${toDelete.length} to delete:\n`);

  for (const b of toDelete) {
    const [bm, rp] = await Promise.all([
      BusinessBookmark.deleteMany({ businessId: b._id }),
      Report.deleteMany({ targetType: 'business', targetId: b._id }),
    ]);
    await Business.deleteOne({ _id: b._id });
    console.log(`🗑  ${b.name}  ← ${b.address}  (bookmark ${bm.deletedCount}, report ${rp.deletedCount})`);
  }

  console.log(`\ndone: ${toDelete.length} deleted, ${kept.length} kept`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
