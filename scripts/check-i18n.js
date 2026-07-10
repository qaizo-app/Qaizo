// scripts/check-i18n.js
// CI guard: every language file must carry the exact key set of en.ts.
// Missing keys silently fall back to English at runtime (i18n.t), so gaps
// ship unnoticed — this fails the build instead. Run: node scripts/check-i18n.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n');
const langs = ['ru', 'he', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'hi', 'ja'];

// Match both quoting styles used in the files:  key: '...'  and  key: "..."
const keysOf = (lang) => {
  const src = fs.readFileSync(path.join(dir, `${lang}.ts`), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^\s{2}(\w+):\s['"]/gm)) keys.add(m[1]);
  return keys;
};

const en = keysOf('en');
let failed = false;
for (const lang of langs) {
  const own = keysOf(lang);
  const missing = [...en].filter(k => !own.has(k));
  const extra = [...own].filter(k => !en.has(k));
  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.error(`✖ ${lang}.ts missing ${missing.length} key(s): ${missing.join(', ')}`);
    if (extra.length) console.error(`✖ ${lang}.ts has ${extra.length} key(s) absent from en.ts: ${extra.join(', ')}`);
  } else {
    console.log(`✓ ${lang}.ts — in sync (${own.size} keys)`);
  }
}

if (failed) {
  console.error('\ni18n check failed: add the missing keys to every language (en.ts is the source of truth).');
  process.exit(1);
}
console.log(`\ni18n OK: 11 languages × ${en.size} keys.`);
