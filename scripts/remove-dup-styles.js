#!/usr/bin/env node
/**
 * createStyles가 있는 파일에서 원래 `const styles = StyleSheet.create(...)` 중복 블록 제거
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');

function findFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

function findMatchingParen(code, start) {
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '(') depth++;
    else if (code[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

let count = 0;
for (const f of findFiles(ROOT)) {
  let code = fs.readFileSync(f, 'utf8');
  if (!/createStyles|create\w+Styles/.test(code)) continue;

  // Find plain `const styles = StyleSheet.create(` (NOT `createStyles = ...`)
  let changed = false;
  const regex = /\nconst\s+(styles|chipStyles)\s*=\s*StyleSheet\.create\(/g;
  let m;
  // Collect all matches first
  const toRemove = [];
  while ((m = regex.exec(code)) !== null) {
    const varName = m[1];
    // Check if this is the factory version (has => before it)
    const lineStart = m.index + 1;
    const line = code.slice(lineStart, code.indexOf('\n', lineStart + 1));
    if (line.includes('=>')) continue; // This is the factory, skip

    const parenStart = code.indexOf('(', lineStart);
    const parenEnd = findMatchingParen(code, parenStart);
    if (parenEnd < 0) continue;
    let blockEnd = parenEnd + 1;
    if (code[blockEnd] === ';') blockEnd++;
    // Also remove preceding blank lines
    let removeStart = lineStart;
    while (removeStart > 0 && code[removeStart - 1] === '\n') removeStart--;
    if (removeStart > 0) removeStart++;
    toRemove.push({ start: removeStart, end: blockEnd });
  }

  // Remove in reverse
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const { start, end } = toRemove[i];
    code = code.slice(0, start) + code.slice(end);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(f, code, 'utf8');
    count++;
  }
}
console.log(`✅ ${count}개 파일에서 중복 StyleSheet 제거`);
