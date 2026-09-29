import { Platform } from 'react-native';
import * as Device from 'expo-device';

// expo.version in package.json is baked in at build time, so it is simply imported as a constant
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
