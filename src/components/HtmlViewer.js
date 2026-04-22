import React, { useState, useMemo, useCallback } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet } from 'react-native';
import { SERVER_HOST } from '../lib/config';

// 게시글 HTML을 WebView로 안전하게 렌더링
// - 본문 스크롤은 부모 ScrollView가 처리 (WebView 자체 스크롤 비활성)
// - 이미지/텍스트가 터치를 가로채지 않도록 함
export default function HtmlViewer({ html, textColor = '#2B2B2B', linkColor = '#1E88E5', fontSize = 16 }) {
  const [height, setHeight] = useState(80);

  const safeHtml = useMemo(() => {
    if (!html) return '';
    let out = html;
    out = out.replace(/<span[^>]*data-img-del[^>]*>[\s\S]*?<\/span>/gi, '');
    out = out.replace(/<span[^>]*data-img-wrap[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    out = out.replace(/src=["'](\/uploads\/[^"']+)["']/g, (m, p) => `src="${SERVER_HOST}${p}"`);
    return out;
  }, [html]);

  const document = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body {
    margin: 0; padding: 0;
    color: ${textColor};
    font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Helvetica Neue", sans-serif;
    font-size: ${fontSize}px;
    line-height: 1.62;
    background: transparent;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  p { margin: 0 0 8px; }
  h1, h2, h3 { margin: 6px 0; font-weight: 800; color: ${textColor}; }
  h1 { font-size: ${fontSize + 6}px; }
  h2 { font-size: ${fontSize + 4}px; }
  h3 { font-size: ${fontSize + 2}px; }
  strong, b { font-weight: 800; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  a { color: ${linkColor}; text-decoration: none; }
  img { max-width: 100%; height: auto; border-radius: 12px; margin: 10px 0; display: block; pointer-events: none; }
  ul, ol { padding-left: 22px; }
</style>
</head>
<body>
${safeHtml}
<script>
  function postHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    window.ReactNativeWebView.postMessage(String(h));
  }
  window.addEventListener('load', postHeight);
  // 이미지 로드 후 높이 재계산
  Array.from(document.images).forEach(function(img) {
    if (img.complete) return;
    img.addEventListener('load', postHeight);
    img.addEventListener('error', postHeight);
  });
  // 폰트/리사이즈 대비
  setTimeout(postHeight, 100);
  setTimeout(postHeight, 500);
  setTimeout(postHeight, 1500);
</script>
</body>
</html>
  `, [safeHtml, textColor, linkColor, fontSize]);

  const onMessage = useCallback((e) => {
    const h = parseInt(e.nativeEvent.data, 10);
    if (!isNaN(h) && h > 0 && Math.abs(h - height) > 2) {
      setHeight(h);
    }
  }, [height]);

  return (
    <View style={[styles.wrap, { height }]} pointerEvents="none">
      <WebView
        originWhitelist={['*']}
        source={{ html: document }}
        onMessage={onMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.web}
        containerStyle={styles.web}
        javaScriptEnabled
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        textZoom={100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  web: { backgroundColor: 'transparent', flex: 1 },
});
