const mongoose = require('mongoose');

// 전역 시스템 설정 (싱글톤) — 점검모드, 금지어, 차단 IP
const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
