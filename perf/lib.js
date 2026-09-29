// Shared measurement helpers — percentile maths and result recording
const fs = require('fs');
const path = require('path');

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    n: s.length,
    min: s[0],
    p50: percentile(s, 50),
    p90: percentile(s, 90),
    p95: percentile(s, 95),
    max: s[s.length - 1],
    mean,
  };
}

function fmt(ms) {
  return Number.isFinite(ms) ? `${ms.toFixed(1)}ms` : '—';
}

// Written straight to stdout so the results table survives muting the server's console.log
const out = (line = '') => process.stdout.write(line + '\n');

function printTable(title, rows) {
  out(`\n${title}`);
  out('  ' + 'name'.padEnd(34) + 'n'.padStart(4) + 'p50'.padStart(10) + 'p90'.padStart(10) + 'p95'.padStart(10) + 'max'.padStart(10));
  for (const [name, st] of rows) {
    out('  ' + name.padEnd(34) + String(st.n).padStart(4) + fmt(st.p50).padStart(10) + fmt(st.p90).padStart(10) + fmt(st.p95).padStart(10) + fmt(st.max).padStart(10));
  }
}

// Saved to perf/results/<label>.json for before/after comparison
function saveResult(label, data) {
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}.json`);
  fs.writeFileSync(file, JSON.stringify({ label, at: new Date().toISOString(), ...data }, null, 2));
  out(`\n→ saved ${path.relative(process.cwd(), file)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { percentile, summarize, fmt, printTable, saveResult, sleep, out };
