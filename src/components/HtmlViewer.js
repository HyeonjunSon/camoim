import React, { useState, useMemo, useCallback } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet, Linking } from 'react-native';
import { SERVER_HOST } from '../lib/config';

// Renders post HTML in a WebView instead of <Text>.
// Why: on iOS a selectable RN <Text> only offers "Copy" for the whole paragraph —
// no range selection — and plain-text URLs never become links. A WebView gives
// native selection handles, and the script below linkifies bare URLs.
// - the parent ScrollView owns scrolling (the WebView's own scrolling is off)
// - links open in the system browser / app (never inside this WebView)
// - image taps are forwarded to onImagePress so the gallery modal still works

export function cleanPostHtml(html) {
  if (!html) return '';
  let out = html;
  // Strip the ✕ buttons and wrappers left behind by an old injection
  out = out.replace(/<span[^>]*data-img-del[^>]*>[\s\S]*?<\/span>/gi, '');
  out = out.replace(/<span[^>]*data-img-wrap[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return out.replace(/src=["'](\/uploads\/[^"']+)["']/g, (m, p) => `src="${SERVER_HOST}${p}"`);
}

// Runs inside the WebView: linkify bare URLs, forward taps, report height
const BRIDGE_JS = `
(function () {
  var URL_RE = /((?:https?:\\/\\/|www\\.)[^\\s<>"']+[^\\s<>"'.,;:!?)\\]])/gi;
  function linkify(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!node.nodeValue || !URL_RE.test(node.nodeValue)) return;
      URL_RE.lastIndex = 0;
      for (var p = node.parentNode; p && p !== root; p = p.parentNode) {
        if (p.nodeName === 'A') return;
      }
      var frag = document.createDocumentFragment();
      var text = node.nodeValue, last = 0, m;
      while ((m = URL_RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = document.createElement('a');
        a.href = /^www\\./i.test(m[0]) ? 'https://' + m[0] : m[0];
        a.textContent = m[0];
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function send(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  var lastH = 0;
  function postHeight() {
    var h = Math.ceil(document.getElementById('root').getBoundingClientRect().height);
    if (h !== lastH) { lastH = h; send({ type: 'height', value: h }); }
  }
  linkify(document.getElementById('root'));
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.nodeName === 'IMG') { e.preventDefault(); send({ type: 'image', src: t.currentSrc || t.src }); return; }
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (a) { e.preventDefault(); send({ type: 'link', href: a.href }); }
  }, true);
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.getElementById('root'));
  Array.prototype.forEach.call(document.images, function (img) {
    img.addEventListener('load', postHeight);
    img.addEventListener('error', postHeight);
  });
  window.addEventListener('load', postHeight);
  postHeight();
})();
true;
`;

const escapeCss = (v) => String(v).replace(/[^#\w(),.\s%-]/g, '');

export default function HtmlViewer({ html, textColor = '#2B2B2B', linkColor = '#1E88E5', fontSize = 15, onImagePress }) {
  const [height, setHeight] = useState(0);

  const document = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    color: ${escapeCss(textColor)};
    font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
    font-size: ${Number(fontSize) || 15}px;
    line-height: 1.6;
    word-break: break-word;
    overflow-wrap: anywhere;
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
  }
  #root { display: flow-root; }
  p, div { margin: 0 0 8px; }
  h1, h2, h3 { margin: 6px 0; font-weight: 800; }
  h1 { font-size: ${fontSize + 6}px; }
  h2 { font-size: ${fontSize + 4}px; }
  h3 { font-size: ${fontSize + 2}px; }
  strong, b { font-weight: 800; }
  a { color: ${escapeCss(linkColor)}; text-decoration: underline; }
  img { max-width: 100% !important; height: auto !important; border-radius: 12px; margin: 10px 0; display: block;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  ul, ol { padding-left: 22px; margin: 0 0 8px; }
</style>
</head>
<body><div id="root">${cleanPostHtml(html)}</div></body>
</html>`, [html, textColor, linkColor, fontSize]);

  const onMessage = useCallback((e) => {
    let msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'height') {
      const h = Number(msg.value);
      if (h > 0) setHeight(h);
    } else if (msg.type === 'link' && /^(https?|mailto|tel):/i.test(msg.href)) {
      Linking.openURL(msg.href).catch(() => {});
    } else if (msg.type === 'image' && msg.src) {
      onImagePress?.(msg.src);
    }
  }, [onImagePress]);

  // Anything that tries to navigate away (e.g. "Open" from the iOS link callout)
  // goes to the OS instead of replacing the post body.
  const onShouldStartLoadWithRequest = useCallback((req) => {
    if (req.url === 'about:blank' || req.url.startsWith('data:')) return true;
    if (/^(https?|mailto|tel):/i.test(req.url)) {
      Linking.openURL(req.url).catch(() => {});
    }
    return false;
  }, []);

  return (
    <View style={[styles.wrap, { height: height || 1 }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: document }}
        injectedJavaScript={BRIDGE_JS}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.web}
        containerStyle={styles.web}
        javaScriptEnabled
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        textZoom={100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  web: { backgroundColor: 'transparent', flex: 1 },
});
