import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { getFontFamily } from '../constants/fonts';

let _applied = false;

export function setupDefaultFonts() {
  if (_applied) return;
  _applied = true;

  // Approach 1: patch Text.render (forwardRef)
  if (typeof Text.render === 'function') {
    const origText = Text.render;
    Text.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return origText.call(this, props, ref);
      const fontFamily = getFontFamily(flat.fontWeight);
      return origText.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref);
    };
  }

  // Approach 2: patch Text.type.render (wrapped components)
  if (Text.type && typeof Text.type.render === 'function') {
    const origType = Text.type.render;
    Text.type.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return origType.call(this, props, ref);
      const fontFamily = getFontFamily(flat.fontWeight);
      return origType.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref);
    };
  }

  // Approach 3: patch the prototype (class components)
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

  // Same treatment for TextInput
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
