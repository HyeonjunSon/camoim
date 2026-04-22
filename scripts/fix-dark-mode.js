#!/usr/bin/env node
/**
 * 다크모드 완성 스크립트
 *
 * 변환:
 * 1. `const styles = StyleSheet.create({...})` → `const createStyles = (colors) => StyleSheet.create({...})`
 * 2. 컴포넌트 안 `const { colors } = useTheme()` 다음에 `const styles = createStyles(colors)` 추가
 * 3. 추가 StyleSheet (chipStyles 등)도 동일 처리
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

// 매칭 괄호 끝 위치 찾기
function findMatchingParen(code, startParen) {
  let depth = 0;
  for (let i = startParen; i < code.length; i++) {
    if (code[i] === '(') depth++;
    else if (code[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

let count = 0;
for (const f of findFiles(ROOT)) {
  if (f.includes('ThemeContext') || f.includes('colors.js') || f.includes('scripts/')) continue;

  let code = fs.readFileSync(f, 'utf8');
  if (!/StyleSheet\.create/.test(code)) continue;
  if (!/useTheme/.test(code)) continue;
  // Already converted
  if (/createStyles/.test(code) || /create\w+Styles/.test(code)) continue;

  // Find all StyleSheet blocks: const XXXstyles = StyleSheet.create(...)
  const styleRegex = /\nconst\s+(\w+)\s*=\s*StyleSheet\.create\(/g;
  const blocks = [];
  let m;
  while ((m = styleRegex.exec(code)) !== null) {
    const varName = m[1];
    const declStart = m.index + 1; // skip \n
    const parenStart = code.indexOf('(', declStart + m[0].length - 1);
    const parenEnd = findMatchingParen(code, parenStart);
    if (parenEnd < 0) continue;
    let blockEnd = parenEnd + 1;
    if (code[blockEnd] === ';') blockEnd++;
    blocks.push({ varName, declStart, blockEnd });
  }

  if (blocks.length === 0) continue;

  // Process blocks in reverse order (to preserve indices)
  const factoryNames = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const original = code.slice(b.declStart, b.blockEnd);
    // const styles = StyleSheet.create(...) → const createStyles = (colors) => StyleSheet.create(...)
    const factoryName = b.varName === 'styles' ? 'createStyles' : `create${b.varName.charAt(0).toUpperCase()}${b.varName.slice(1)}`;
    const replaced = original.replace(
      `const ${b.varName} = StyleSheet.create(`,
      `const ${factoryName} = (colors) => StyleSheet.create(`
    );
    code = code.slice(0, b.declStart) + replaced + code.slice(b.blockEnd);
    factoryNames.unshift({ varName: b.varName, factoryName });
  }

  // Add `const styles = createStyles(colors);` etc. after `const { colors } = useTheme();`
  const themeMatch = code.match(/const\s*\{[^}]*colors[^}]*\}\s*=\s*useTheme\(\);?\n/);
  if (themeMatch) {
    const insertPos = themeMatch.index + themeMatch[0].length;
    const lines = factoryNames.map(fn => `  const ${fn.varName} = ${fn.factoryName}(colors);`).join('\n');
    code = code.slice(0, insertPos) + lines + '\n' + code.slice(insertPos);
  }

  fs.writeFileSync(f, code, 'utf8');
  count++;
}

console.log(`✅ ${count}개 파일 변환 완료`);
