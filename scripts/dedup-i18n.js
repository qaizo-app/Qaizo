// scripts/dedup-i18n.js
// One-shot: remove duplicate keys from src/i18n/<lang>.js files.
// JS object-literal semantics: when a key is repeated, only the LAST
// definition is reachable at runtime. We keep that one and delete the
// earlier (dead) entries. Result is a runtime no-op.
//
// Usage: node scripts/dedup-i18n.js
const fs = require('fs');
const path = require('path');

const langs = ['ar', 'de', 'en', 'es', 'fr', 'he', 'hi', 'ja', 'pt', 'ru', 'zh'];
const KEY_RE = /^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:/;

let totalRemoved = 0;
for (const lang of langs) {
  const file = path.join('src', 'i18n', `${lang}.js`);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  const lastSeenLineForKey = new Map();
  const linesToDelete = new Set();

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(KEY_RE);
    if (!m) continue;
    const key = m[1];
    if (lastSeenLineForKey.has(key)) {
      linesToDelete.add(lastSeenLineForKey.get(key));
    }
    lastSeenLineForKey.set(key, i);
  }

  if (linesToDelete.size === 0) {
    console.log(`${lang}: no duplicates`);
    continue;
  }

  const newLines = lines.filter((_, i) => !linesToDelete.has(i));
  fs.writeFileSync(file, newLines.join('\n'));
  console.log(`${lang}: removed ${linesToDelete.size} duplicate lines`);
  totalRemoved += linesToDelete.size;
}

console.log(`\nTotal removed: ${totalRemoved} lines`);
