const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  blockerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  blockedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  blockChat:   { type: Boolean, default: true },
  hideContent: { type: Boolean, default: true },
}, { timestamps: true });

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

// Any block/unblock invalidates the whole block-list cache (utils/blocks.js)
// Blocks are rare, so clearing everything costs almost nothing and leaves less room to be wrong than partial invalidation
const invalidate = () => require('../utils/blocks').invalidateBlockCache();
blockSchema.post('save', invalidate);
blockSchema.post('deleteOne', { document: true, query: false }, invalidate);
blockSchema.post(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany'],
  invalidate
);
blockSchema.post('insertMany', invalidate);
blockSchema.post('bulkWrite', invalidate);

module.exports = mongoose.model('Block', blockSchema);
