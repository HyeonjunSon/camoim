const mongoose = require('mongoose');

// 숙소 — 유저가 직접 올리는 마켓플레이스 (업체 큐레이션과 분리)
// 프라이버시: 정확 주소(address)·정확 좌표(location)는 서버 전용.
// 클라엔 대략 위치(approxLocation)만 내려주고, 정확 주소는 호스트 채팅으로만 공유.
const STAY_TYPES = ['minbak', 'roomrent', 'homestay', 'hasuk'];
const STAY_CITIES = ['toronto', 'vancouver', 'montreal'];
// 조건은 i18n 키로 저장 → 표시 시점에 언어별로 번역 (한/영 사용자 모두 대응)
const STAY_CONDITIONS = [
  'femaleOnly', 'maleOnly', 'anyGender', 'studentOnly',
  'privateRoom', 'sharedRoom', 'privateBath', 'sharedBath',
  'mealIncluded', 'cooking', 'utilIncluded', 'furnished', 'laundry', 'wifi', 'parking',
  'noSmoking', 'petsOk', 'immediate', 'shortTerm',
];

const stayListingSchema = new mongoose.Schema({
  title:    { type: String, required: true, trim: true, maxlength: 100 },
  stayType: { type: String, enum: STAY_TYPES, required: true, index: true },
  // 도시 제한 없음 — 위치는 주소(정확 좌표)로 결정. city는 참고용 라벨(옵션)
  city:     { type: String, default: '', index: true },

  price:     { type: Number, required: true, min: 0 },  // 가격 (CAD)
  priceUnit: { type: String, enum: ['month', 'night'], default: 'month' }, // 월세 / 1박 (민박용)
  deposit:   { type: Number, default: 0, min: 0 },      // 보증금

  conditions:  { type: [String], default: [] },       // STAY_CONDITIONS 키
  description: { type: String, default: '', maxlength: 2000 },
  images:      { type: [String], default: [] },

  // 정확 위치 — 서버 전용 (formatStay가 절대 노출 안 함)
  address:  { type: String, required: true, trim: true, maxlength: 200 },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }, // [lng, lat]
  },
  // 대략 위치 — 클라 노출용 (정확 좌표를 ~250m 지터). 지도 핀/거리 계산에 사용
  approxLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },
  neighborhood: { type: String, default: '', trim: true, maxlength: 80 }, // "North York · Finch역 도보 5분"

  moveInDate:    { type: String, default: '', trim: true, maxlength: 40 }, // 입주 가능일 (자유 텍스트)
  minLeaseMonths:{ type: Number, default: 0, min: 0 },                     // 최소 계약 (개월)
  includes:      { type: String, default: '', trim: true, maxlength: 200 },// 포함 사항 "아침·저녁 2식·세탁·Wi-Fi"

  host:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hostNickname: { type: String, default: '' }, // 등록 시점 스냅샷

  // roomrent 게시글에서 만든 숙소면 원본 글 ID. 글의 입주완료 토글과 상태 동기화용
  sourcePostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null, index: true },

  status: { type: String, enum: ['active', 'closed'], default: 'active', index: true }, // 입주가능 / 입주완료
  bookmarkCount: { type: Number, default: 0 },
  reportCount:   { type: Number, default: 0 },
}, { timestamps: true });

stayListingSchema.index({ city: 1, status: 1, stayType: 1 });

// 정확 좌표 → 대략 좌표 (약 200~300m 랜덤 오프셋). 저장 시 1회 계산해 고정.
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
