import { createContext, useContext, useState, useEffect } from 'react';
import {
  setToken, getToken, clearToken,
  getCachedUser, setCachedUser, clearCachedUser,
} from '../lib/storage';
import { restoreSession } from '../lib/session';
import { mark } from '../lib/perf';
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  logout as apiLogout,
  appleLogin as apiAppleLogin,
  googleLogin as apiGoogleLogin,
  socialComplete as apiSocialComplete,
} from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cold-start session restore — render immediately from the cached user, then refresh via /auth/me (lib/session.js)
  useEffect(() => {
    let first = true;
    restoreSession({
      getToken,
      getCachedUser,
      fetchMe: getMe,
      onUser: (u, source) => {
        setUser(u);
        if (first) {
          // The first moment a screen can be drawn — before the network responds, when a cache exists
          first = false;
          setLoading(false);
          mark('session_ready', { sessionSource: source });
        }
      },
      onSignedOut: async () => {
        await clearToken();
        await clearCachedUser();
      },
    }).finally(() => setLoading(false));
  }, []);

  // Refresh the cache whenever the user changes (login, profile edits and /auth/me responses all land here)
  useEffect(() => {
    if (user) setCachedUser(user);
  }, [user]);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    if (!res.success) throw new Error(res.message);
    await setToken(res.data.token);
    setUser(res.data.user);
  };

  const register = async (email, password, nickname, role, city) => {
    const res = await apiRegister(email, password, nickname, role, city);
    if (!res.success) throw new Error(res.message);
    await setToken(res.data.token);
    setUser(res.data.user);
  };

  // Apple/Google login — take the verified idToken and pass it to the server
  // Result: { needsOnboarding: true, preRegToken, provider, email }, or a completed user login
  const loginWithApple = async (identityToken) => {
    const res = await apiAppleLogin(identityToken);
    if (!res.success) throw new Error(res.message);
    if (res.data.needsOnboarding) {
      return { needsOnboarding: true, preRegToken: res.data.preRegToken, provider: 'apple', email: res.data.email };
    }
    await setToken(res.data.token);
    setUser(res.data.user);
    return { needsOnboarding: false };
  };

  const loginWithGoogle = async (idToken) => {
    const res = await apiGoogleLogin(idToken);
    if (!res.success) throw new Error(res.message);
    if (res.data.needsOnboarding) {
      return { needsOnboarding: true, preRegToken: res.data.preRegToken, provider: 'google', email: res.data.email };
    }
    await setToken(res.data.token);
    setUser(res.data.user);
    return { needsOnboarding: false };
  };

  // Social signup onboarding complete
  const completeOnboarding = async (preRegToken, { nickname, role, city }) => {
    const res = await apiSocialComplete(preRegToken, nickname, role, city);
    if (!res.success) throw new Error(res.message);
    await setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = async () => {
    // Ask the server to bump tokenVersion — local cleanup proceeds even if that fails
    try { await apiLogout(); } catch {}
    await clearToken();
    await clearCachedUser();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await getMe();
      if (res.success) setUser(res.data);
    } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, register, logout, refreshUser,
      loginWithApple, loginWithGoogle, completeOnboarding,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
