import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'camoim_token';

// 토큰 저장 (앱 재시작 후에도 유지)
export const setToken = async (token) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

// 토큰 조회
export const getToken = async () => {
  return await AsyncStorage.getItem(TOKEN_KEY);
};

// 토큰 삭제 (로그아웃 시)
export const clearToken = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
};
