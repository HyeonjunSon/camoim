// Boots and tears down an in-memory MongoDB — never touches the production Atlas cluster.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 10000 });
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  );
  // Driver-level deletes bypass the Mongoose hooks, so the app caches are cleared explicitly
  require('../../utils/cache').clearAllCaches();
}

async function close() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { connect, clear, close };
