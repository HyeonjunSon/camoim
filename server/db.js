const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // 연결 실패 시 5초 안에 에러
      socketTimeoutMS: 45000,          // 소켓 45초 유지
      maxPoolSize: 10,                 // 연결 풀 유지 (재연결 방지)
    });
    console.log('✅ MongoDB 연결 성공');
  } catch (err) {
    console.error('MongoDB 연결 실패:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
