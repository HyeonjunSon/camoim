import { Platform, Linking } from 'react-native';

// Store ids — eas.json (submit.production.ios.ascAppId) and app.json (android.package)
export const IOS_APP_ID = '6763469709';
export const ANDROID_PACKAGE = 'com.hyeonjun122.cahanin';

// "1.0.10" vs "1.0.9" compared numerically, missing parts count as 0
export function compareVersions(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export const isNewerVersion = (latest, current) =>
  !!latest && !!current && compareVersions(latest, current) > 0;

// The version currently live on the App Store. Google Play has no public lookup API, so Android
// uses the same number — both platforms ship the same version together.
// Hermes has no AbortSignal.timeout(), hence the manual controller.
export async function fetchStoreVersion({ timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${IOS_APP_ID}&country=ca&_=${Date.now()}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.results?.[0]?.version || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function openStore() {
  const url = Platform.OS === 'ios'
    ? `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`
    : `market://details?id=${ANDROID_PACKAGE}`;
  // market:// and itms-apps:// fail when no store app handles them (an emulator, a device
  // without Play Services), so fall back to the https page, which a browser opens.
  return Linking.openURL(url).catch(() => {
    const web = Platform.OS === 'ios'
      ? `https://apps.apple.com/app/id${IOS_APP_ID}`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    return Linking.openURL(web).catch(() => {});
  });
}
