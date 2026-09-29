// Board list cache — boards change only when an admin edits them (once every few months), yet three
// home screen APIs were re-reading the same list from the DB on every request.
// Invalidation is handled by the write hooks in models/Board.js, so no write path is missed.
const { createCache } = require('./cache');

const cache = createCache({ ttlMs: 60_000 }); // Safety net for the cases the hooks miss (writes made straight through the driver)

// Every board — same ordering as Board.find(). The returned array and objects are shared, so they are frozen
function getAllBoards() {
  return cache.get('all', async () => {
    const Board = require('../models/Board'); // Avoids a model ↔ cache circular import
    const boards = await Board.find({}).sort({ isUniversityBoard: 1, sortOrder: 1 }).lean();
    return Object.freeze(boards.map((b) => Object.freeze(b)));
  });
}

function invalidateBoards() {
  cache.clear();
}

module.exports = { getAllBoards, invalidateBoards };
