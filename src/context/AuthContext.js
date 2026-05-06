import { createContext, useContext, useState, useEffect } from 'react';
import { setToken, getToken, clearToken } from '../lib/storage';
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

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getToken();
        if (token) {
          const res = await getMe();
          if (res.success) setUser(res.data);
          else await clearToken();
        }
      } catch (e) {
        await clearToken();
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

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

  // Apple/Google 로그인 — 검증된 idToken 받아서 서버에 전달
  // 결과: { needsOnboarding: true, preRegToken, provider, email } 또는 user 로그인 완료
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

  // 소셜 가입 onboarding 완료
  const completeOnboarding = async (preRegToken, { nickname, role, city }) => {
    const res = await apiSocialComplete(preRegToken, nickname, role, city);
    if (!res.success) throw new Error(res.message);
    await setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = async () => {
    // 서버에 tokenVersion 증가 요청 — 실패해도 로컬 정리는 진행
    try { await apiLogout(); } catch {}
    await clearToken();
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
