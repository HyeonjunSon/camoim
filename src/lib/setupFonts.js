import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { getFontFamily } from '../constants/fonts';

let _applied = false;

export function setupDefaultFonts() {
  if (_applied) return;
  _applied = true;

  // 방법 1: Text.render 패치 (forwardRef)
  if (typeof Text.render === 'function') {
    const origText = Text.render;
    Text.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return origText.call(this, props, ref);
      const fontFamily = getFontFamily(flat.fontWeight);
      return origText.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref);
    };
  }

  // 방법 2: Text.type.render 패치 (래핑된 컴포넌트)
  if (Text.type && typeof Text.type.render === 'function') {
    const origType = Text.type.render;
    Text.type.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return origType.call(this, props, ref);
      const fontFamily = getFontFamily(flat.fontWeight);
      return origType.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref);
    };
  }

  // 방법 3: prototype 패치 (클래스 컴포넌트)
  if (Text.prototype && typeof Text.prototype.render === 'function') {
    const origProto = Text.prototype.render;
    Text.prototype.render = function () {
      const flat = StyleSheet.flatten(this.props.style) || {};
      if (flat.fontFamily) return origProto.call(this);
      const fontFamily = getFontFamily(flat.fontWeight);
      const origProps = this.props;
      this.props = { ...origProps, style: [{ fontFamily }, origProps.style] };
      const result = origProto.call(this);
      this.props = origProps;
      return result;
    };
  }

  // TextInput도 동일하게
  if (typeof TextInput.render === 'function') {
    const origInput = TextInput.render;
    TextInput.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return origInput.call(this, props, ref);
      const fontFamily = getFontFamily(flat.fontWeight);
      return origInput.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref);
    };
  }

  if (TextInput.type && typeof TextInput.type.render === 'function') {
    const origInputType = TextInput.type.render;
    TextInput.type.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return origInputType.call(this, props, ref);
      const fontFamily = getFontFamily(flat.fontWeight);
      return origInputType.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref);
    };
  }
}
