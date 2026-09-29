const mongoose = require('mongoose');

// Korean-run businesses (map) — user submissions + admin entries, shown on the map once approved
// Automatic Google Places import is on hold for 1.0.x ('google' stays in the source enum for later)
const CATEGORIES = ['food', 'cafe', 'mart', 'hair', 'clinic', 'realty', 'etc'];
const CITIES = ['toronto', 'vancouver', 'montreal'];

const businessSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  category:    { type: String, enum: CATEGORIES, required: true, index: true },
  city:        { type: String, required: true, index: true },
  address:     { type: String, required: true, trim: true, maxlength: 200 },
  phone:       { type: String, default: '', trim: true, maxlength: 40 },
  hours:       { type: String, default: '', trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  images:      { type: [String], default: [] },

  // GeoJSON Point — [lng, lat]. Left unset when geocoding fails (dropped from the map, still in the list)
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },

  source:   { type: String, enum: ['google', 'admin', 'user'], default: 'user', index: true },
  status:   { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

  submittedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submitterNickname: { type: String, default: '' }, // Snapshot taken at submission time
  sourceName: { type: String, default: '' }, // Attribution for partner data (e.g. Korea Times Canada)

  bookmarkCount: { type: Number, default: 0 },
  reportCount:   { type: Number, default: 0 },
  // Review rollup (denormalized from BusinessReview so list and map show stars without a join)
  ratingAvg:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  rejectedReason: { type: String, default: '' },
}, { timestamps: true });

// Geo search (documents without location are excluded automatically)
businessSchema.index({ location: '2dsphere' });
// Filter combination used by the map list
businessSchema.index({ city: 1, status: 1, category: 1 });

businessSchema.statics.CATEGORIES = CATEGORIES;
businessSchema.statics.CITIES = CITIES;

module.exports = mongoose.model('Business', businessSchema);
