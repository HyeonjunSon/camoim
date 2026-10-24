// The one rule for which posts a public list may show: nothing an admin hid and
// nothing auto-hidden by reports. Spread it into every Post query that feeds a
// list other people see. The admin console has its own route and the author's
// own "my posts" list deliberately skips it.
const VISIBLE_POST = Object.freeze({ hidden: { $ne: true }, autoHidden: { $ne: true } });

// A hidden post's detail page is open only to its author.
function isHiddenFrom(post, userId) {
  if (!post.hidden && !post.autoHidden) return false;
  const ownerId = String(post.userId?._id || post.userId);
  return !userId || ownerId !== String(userId);
}

module.exports = { VISIBLE_POST, isHiddenFrom };
