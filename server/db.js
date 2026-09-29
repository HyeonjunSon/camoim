const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // Fail within 5s if the connection cannot be established
      socketTimeoutMS: 45000,          // Keep sockets alive for 45s
      maxPoolSize: 10,                 // Hold the connection pool open (avoids reconnect churn)
    });
    console.log('✅ MongoDB 연결 성공');
  } catch (err) {
    console.error('MongoDB 연결 실패:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
