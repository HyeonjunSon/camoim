const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isAnonymousAllowed: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  university: { type: String, default: '' }, // Empty string = visible to everyone; a value restricts the board to that university
  isUniversityBoard: { type: Boolean, default: false },
});

// Hot query: university board filter/sort
boardSchema.index({ isUniversityBoard: 1, sortOrder: 1 });
boardSchema.index({ university: 1 });

// Any write invalidates the board cache (utils/boardCache.js)
// Covers document save/delete, query update/delete, insertMany and bulkWrite
const invalidate = () => require('../utils/boardCache').invalidateBoards();
boardSchema.post('save', invalidate);
boardSchema.post('deleteOne', { document: true, query: false }, invalidate);
boardSchema.post(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany'],
  invalidate
);
boardSchema.post('insertMany', invalidate);
boardSchema.post('bulkWrite', invalidate);

module.exports = mongoose.model('Board', boardSchema);
