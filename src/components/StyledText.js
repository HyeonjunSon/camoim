import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import React, { forwardRef } from 'react';
import { getFontFamily } from '../constants/fonts';

// Pretendard 폰트가 자동 적용되는 Text
export const Text = forwardRef(({ style, ...props }, ref) => {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) {
    return <RNText ref={ref} style={style} {...props} />;
  }
  const fontFamily = getFontFamily(flat.fontWeight);
  return <RNText ref={ref} style={[{ fontFamily }, style]} {...props} />;
});

// Pretendard 폰트가 자동 적용되는 TextInput
export const TextInput = forwardRef(({ style, ...props }, ref) => {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) {
    return <RNTextInput ref={ref} style={style} {...props} />;
  }
  const fontFamily = getFontFamily(flat.fontWeight);
  return <RNTextInput ref={ref} style={[{ fontFamily }, style]} {...props} />;
});
