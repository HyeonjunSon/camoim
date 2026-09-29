// Retry the improved geocoder against businesses saved without coordinates (idempotent).
// Run: railway run node scripts/backfillBusinessGeo.js
require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const { geocodeAddress } = require('../utils/geocode');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Businesses with no location, or an empty coordinate array
  const list = await Business.find({
    $or: [
      { location: { $exists: false } },
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates': { $size: 0 } },
    ],
  }).lean();

  console.log(`found ${list.length} businesses with no coordinates\n`);
  let fixed = 0, stillFail = 0;

  for (const b of list) {
    const geo = await geocodeAddress(b.address, b.city);
    if (geo) {
      await Business.updateOne(
        { _id: b._id },
        { $set: { location: { type: 'Point', coordinates: [geo.lng, geo.lat] } } }
      );
      fixed++;
      console.log(`✅ ${b.name}  ← ${b.address}`);
      console.log(`   ${geo.lat}, ${geo.lng}`);
    } else {
      stillFail++;
      console.log(`❌ ${b.name}  ← ${b.address}  (still failing — needs manual coordinates)`);
    }
    // Nominatim rate limit
    await new Promise((s) => setTimeout(s, 1200));
  }

  console.log(`\ndone: ${fixed} filled in, ${stillFail} still failing`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
