import { Platform } from 'react-native';
import * as Device from 'expo-device';

// package.json의 expo.version은 빌드시점에 박히므로 그냥 하드코딩 import
let APP_VERSION = '';
try {
  // eslint-disable-next-line global-require
  APP_VERSION = require('../../app.json')?.expo?.version ?? '';
} catch {}

export function getDeviceInfo() {
  return {
    appVersion: APP_VERSION,
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
    deviceModel: Device.modelName ?? '',
  };
}
