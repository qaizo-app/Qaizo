// scripts/find-dead-i18n.js
// Maintenance tool (NOT a CI gate — dynamic usage makes this heuristic).
// Lists en.ts keys with no static reference in src/ or App.js, after
// whitelisting every dynamically-built family it can detect:
//   - template usages: i18n.t(`prefix${...}`)  → whitelist prefix*
//   - category ids: i18n.t(categoryId) resolves raw ids → whitelist every id
//     found in theme/colors.ts categoryConfig and the DEFAULT_GROUPS subs
// Run: node scripts/find-dead-i18n.js   (add --json for machine output)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const enSrc = fs.readFileSync(path.join(SRC, 'i18n', 'en.ts'), 'utf8');
const keys = [];
for (const m of enSrc.matchAll(/^\s{2}(\w+):\s['"]/gm)) keys.push(m[1]);

let blob = '';
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!p.includes('i18n')) walk(p); }
    else if (/\.(js|ts|tsx)$/.test(e.name)) blob += fs.readFileSync(p, 'utf8') + '\n';
  }
};
walk(SRC);
blob += fs.readFileSync(path.join(ROOT, 'App.js'), 'utf8');

// 1. Template-literal prefixes: t(`foo${ → whitelist keys starting with 'foo'
const prefixes = new Set();
for (const m of blob.matchAll(/\bt\(\s*`([A-Za-z0-9_]+)\$\{/g)) prefixes.add(m[1]);

// 2. Category ids (t(categoryId) family): categoryConfig keys + DEFAULT_GROUPS sub/group ids
const catIds = new Set();
const colorsSrc = fs.readFileSync(path.join(SRC, 'theme', 'colors.ts'), 'utf8');
const cfgStart = colorsSrc.indexOf('categoryConfig');
if (cfgStart >= 0) {
  for (const m of colorsSrc.slice(cfgStart).matchAll(/^\s{2}(\w+):\s*\{/gm)) catIds.add(m[1]);
}
const pickerSrc = fs.readFileSync(path.join(SRC, 'components', 'CategoryPickerModal.js'), 'utf8');
for (const m of pickerSrc.matchAll(/id:\s*'(\w+)'/g)) catIds.add(m[1]);

const isDynamic = (k) =>
  catIds.has(k) ||
  [...prefixes].some(p => k.startsWith(p));

const dead = keys.filter(k =>
  !blob.includes(`'${k}'`) && !blob.includes(`"${k}"`) && !isDynamic(k));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(dead));
} else {
  console.log(`en.ts keys: ${keys.length}`);
  console.log(`template prefixes detected: ${[...prefixes].join(', ') || '(none)'}`);
  console.log(`category ids whitelisted: ${catIds.size}`);
  console.log(`\nDEAD (${dead.length}):`);
  console.log(dead.join('\n'));
}
