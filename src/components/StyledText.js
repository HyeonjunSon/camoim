import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import React, { forwardRef } from 'react';
import { getFontFamily } from '../constants/fonts';

// Text with the Pretendard font applied automatically
export const Text = forwardRef(({ style, ...props }, ref) => {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) {
    return <RNText ref={ref} style={style} {...props} />;
  }
  const fontFamily = getFontFamily(flat.fontWeight);
  return <RNText ref={ref} style={[{ fontFamily }, style]} {...props} />;
});

// TextInput with the Pretendard font applied automatically
export const TextInput = forwardRef(({ style, ...props }, ref) => {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) {
    return <RNTextInput ref={ref} style={style} {...props} />;
  }
  const fontFamily = getFontFamily(flat.fontWeight);
  return <RNTextInput ref={ref} style={[{ fontFamily }, style]} {...props} />;
});
