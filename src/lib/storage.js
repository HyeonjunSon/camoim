import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'camoim_token';

// Persist the token (survives an app restart)
export const setToken = async (token) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

// Read the token
export const getToken = async () => {
  return await AsyncStorage.getItem(TOKEN_KEY);
};

// Remove the token (on logout)
export const clearToken = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
};

// ── User cache ────────────────────────────────────────────
// Stores the last user we received so a cold start can draw the home screen without waiting
// on /auth/me (stale-while-revalidate). Same store as the token, so the sensitivity matches.
const USER_KEY = 'camoim_user';

export const setCachedUser = async (user) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
};

export const getCachedUser = async () => {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // A corrupt cache is treated as absent, falling back to the network
  }
};

export const clearCachedUser = async () => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {}
};
