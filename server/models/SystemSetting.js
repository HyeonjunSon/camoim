const mongoose = require('mongoose');

// Global system settings (singleton) — maintenance mode, banned words, blocked IPs
const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
