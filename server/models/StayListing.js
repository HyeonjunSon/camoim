const mongoose = require('mongoose');

// Stays — a user-posted marketplace, separate from the curated business listings
// Privacy: the exact address and exact coordinates are server-only.
// Clients receive the approximate location only; the exact address is shared through host chat.
const STAY_TYPES = ['minbak', 'roomrent', 'homestay', 'hasuk'];
const STAY_CITIES = ['toronto', 'vancouver', 'montreal'];
// Conditions are stored as i18n keys and translated at render time, so Korean and English users both work
const STAY_CONDITIONS = [
  'femaleOnly', 'maleOnly', 'anyGender', 'studentOnly',
  'privateRoom', 'sharedRoom', 'privateBath', 'sharedBath',
  'mealIncluded', 'cooking', 'utilIncluded', 'furnished', 'laundry', 'wifi', 'parking',
  'noSmoking', 'petsOk', 'immediate', 'shortTerm',
];

const stayListingSchema = new mongoose.Schema({
  title:    { type: String, required: true, trim: true, maxlength: 100 },
  stayType: { type: String, enum: STAY_TYPES, required: true, index: true },
  // No city restriction — position comes from the address (exact coords). city is an optional display label
  city:     { type: String, default: '', index: true },

  price:     { type: Number, required: true, min: 0 },  // Price (CAD)
  priceUnit: { type: String, enum: ['month', 'night'], default: 'month' }, // Per month / per night (for short stays)
  deposit:   { type: Number, default: 0, min: 0 },      // Deposit

  conditions:  { type: [String], default: [] },       // STAY_CONDITIONS keys
  description: { type: String, default: '', maxlength: 2000 },
  images:      { type: [String], default: [] },

  // Exact position — server-only (formatStay never exposes it)
  address:  { type: String, required: true, trim: true, maxlength: 200 },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }, // [lng, lat]
  },
  // Approximate position — safe for clients (exact coords jittered by ~250m). Used for map pins and distances
  approxLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },
  neighborhood: { type: String, default: '', trim: true, maxlength: 80 }, // "North York · 5 min walk from Finch station"

  moveInDate:    { type: String, default: '', trim: true, maxlength: 40 }, // Move-in date (YYYY-MM-DD / 'immediate' / free text)
  availableUntil:{ type: String, default: '', trim: true, maxlength: 40 }, // End date for short stays (YYYY-MM-DD). Empty means long-term or open-ended
  minLeaseMonths:{ type: Number, default: 0, min: 0 },                     // Minimum term, in months
  includes:      { type: String, default: '', trim: true, maxlength: 200 },// What's included, e.g. "2 meals a day, laundry, Wi-Fi"

  host:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hostNickname: { type: String, default: '' }, // Snapshot at listing time

  // Source post ID when the stay came from a roomrent post. Keeps the post's filled toggle in sync
  sourcePostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null, index: true },

  status: { type: String, enum: ['active', 'closed'], default: 'active', index: true }, // Available / filled
  bookmarkCount: { type: Number, default: 0 },
  reportCount:   { type: Number, default: 0 },
}, { timestamps: true });

stayListingSchema.index({ city: 1, status: 1, stayType: 1 });

// Exact coords to approximate coords (a random ~200-300m offset). Computed once on save, then fixed.
stayListingSchema.statics.jitter = function (lng, lat) {
  const r = 0.0022;                          // ~250m
  const a = Math.random() * Math.PI * 2;
  const d = r * (0.5 + Math.random() * 0.5); // 125~250m
  const lngScale = Math.cos((lat * Math.PI) / 180) || 1;
  return [lng + (Math.cos(a) * d) / lngScale, lat + Math.sin(a) * d];
};

module.exports = mongoose.model('StayListing', stayListingSchema);
module.exports.STAY_TYPES = STAY_TYPES;
module.exports.STAY_CITIES = STAY_CITIES;
module.exports.STAY_CONDITIONS = STAY_CONDITIONS;
