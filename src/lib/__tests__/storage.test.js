import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedUser, setCachedUser, clearCachedUser } from '../storage';

beforeEach(() => AsyncStorage.clear());

describe('user cache', () => {
  it('returns the stored user unchanged', async () => {
    await setCachedUser({ id: 'u1', nickname: 'jun' });
    expect(await getCachedUser()).toEqual({ id: 'u1', nickname: 'jun' });
  });

  it('null when absent', async () => {
    expect(await getCachedUser()).toBeNull();
  });

  it('null on broken JSON (restore from the network instead of crashing)', async () => {
    await AsyncStorage.setItem('camoim_user', '{broken');
    expect(await getCachedUser()).toBeNull();
  });

  it('cleared on logout', async () => {
    await setCachedUser({ id: 'u1' });
    await clearCachedUser();
    expect(await getCachedUser()).toBeNull();
  });
});
