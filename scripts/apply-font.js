/**
 * react-native에서 Text/TextInput을 빼고 StyledText에서 import하도록 자동 교체
 * node scripts/apply-font.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
// StyledText.js와 setupFonts.js는 건드리지 않음
const SKIP = ['StyledText.js', 'setupFonts.js'];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.js') && !SKIP.includes(entry.name)) files.push(full);
  }
  return files;
}

let changed = 0;

for (const file of walk(SRC)) {
  let code = fs.readFileSync(file, 'utf8');

  // react-native import에서 Text/TextInput 사용 여부 확인
  const rnImportRe = /import\s*\{([^}]+)\}\s*from\s*['"]react-native['"]/;
  const match = code.match(rnImportRe);
  if (!match) continue;

  const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
  const hasText = imports.includes('Text');
  const hasTextInput = imports.includes('TextInput');

  if (!hasText && !hasTextInput) continue;

  // react-native import에서 Text/TextInput 제거
  const remaining = imports.filter(s => s !== 'Text' && s !== 'TextInput');

  // 남은 import가 없으면 import 줄 자체 삭제
  let newRnImport;
  if (remaining.length === 0) {
    newRnImport = '';
  } else {
    // 원본 포맷 유지 (개행 포함된 경우 처리)
    newRnImport = `import {\n  ${remaining.join(',\n  ')},\n} from 'react-native'`;
    // 짧으면 한줄로
    if (remaining.length <= 4) {
      newRnImport = `import { ${remaining.join(', ')} } from 'react-native'`;
    }
  }

  // 원본 import 줄 교체 (여러 줄 import도 처리)
  const rnMultilineRe = /import\s*\{[\s\S]*?\}\s*from\s*['"]react-native['"]\s*;?/;
  code = code.replace(rnMultilineRe, newRnImport);

  // StyledText import 추가
  const styledImports = [];
  if (hasText) styledImports.push('Text');
  if (hasTextInput) styledImports.push('TextInput');

  // 파일에서 StyledText까지의 상대 경로 계산
  const fileDir = path.dirname(file);
  let relPath = path.relative(fileDir, path.join(SRC, 'components', 'StyledText'));
  if (!relPath.startsWith('.')) relPath = './' + relPath;
  // Windows 역슬래시 처리
  relPath = relPath.replace(/\\/g, '/');

  const styledImportLine = `import { ${styledImports.join(', ')} } from '${relPath}';`;

  // 이미 StyledText import가 있으면 스킵
  if (code.includes('StyledText')) continue;

  // 첫 번째 import 뒤에 StyledText import 삽입
  const firstImportEnd = code.indexOf('\n', code.indexOf('import '));
  if (firstImportEnd !== -1) {
    code = code.slice(0, firstImportEnd + 1) + styledImportLine + '\n' + code.slice(firstImportEnd + 1);
  }

  fs.writeFileSync(file, code, 'utf8');
  changed++;
  console.log(`✓ ${path.relative(SRC, file)} — Text:${hasText} TextInput:${hasTextInput}`);
}

console.log(`\n완료: ${changed}개 파일 수정됨`);
