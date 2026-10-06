// Intro board option lists — kept dependency-free (no mongoose) so the client test suite
// can require this file directly to check client/server enums stay in sync.
const INTRO_GENDERS = ['male', 'female'];
const INTRO_JOBS = ['student', 'office', 'professional', 'business', 'workinghol', ''];
const INTRO_CONTACT_TYPES = ['instagram', 'kakao', ''];
const INTRO_EXPIRY_DAYS = 30;

module.exports = { INTRO_GENDERS, INTRO_JOBS, INTRO_CONTACT_TYPES, INTRO_EXPIRY_DAYS };
