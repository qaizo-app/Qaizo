// seed-firestore.js
// Run this script once to populate Firestore with test data.
// Place this file in the project ROOT (same folder as package.json).
//
// Setup:
//   1. npm install firebase-admin
//   2. Download serviceAccount.json from Firebase Console →
//      Project Settings → Service accounts → Generate new private key
//   3. node seed-firestore.js
//
// IMPORTANT: Never commit serviceAccount.json to git!

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─── CHANGE THIS to your real UID after creating a test user in Firebase Auth ──
// Firebase Console → Authentication → Users → copy the UID
const userId = 'test-user-001';
// ──────────────────────────────────────────────────────────────────────────────

const base = db.collection('users').doc(userId);

async function seed() {
  console.log(`Seeding data for user: ${userId}\n`);

  // ── Settings ──────────────────────────────────────────────────────────────
  await base.collection('settings').doc('config').set({
    language:  'ru',
    currency:  '₪',
    theme:     'dark',
    payday:    10,
    createdAt: admin.firestore.Timestamp.now(),
  });
  console.log('✓ Settings');

  // ── Accounts ──────────────────────────────────────────────────────────────
  const accounts = [
    { id: 'account-001', data: { name: 'Mizrahi',   type: 'bank',    currency: '₪', balance: 15000,  overdraft: 5000,  isActive: true, icon: 'bank-outline',        accountNumber: '1234', usageCount: 0 } },
    { id: 'account-002', data: { name: 'Visa Max',  type: 'credit',  currency: '₪', balance: -2300,  overdraft: 10000, isActive: true, icon: 'credit-card-outline', accountNumber: '2027', usageCount: 0 } },
    { id: 'account-003', data: { name: 'One Zero',  type: 'bank',    currency: '₪', balance: 8000,   overdraft: 3000,  isActive: true, icon: 'bank-outline',        accountNumber: '5511', usageCount: 0 } },
    { id: 'account-004', data: { name: 'Wallet Alex', type: 'cash', currency: '₪', balance: 450,    overdraft: 0,     isActive: true, icon: 'wallet-outline',      accountNumber: '',     usageCount: 0 } },
  ];
  for (const { id, data } of accounts) {
    await base.collection('accounts').doc(id).set(data);
  }
  console.log('✓ Accounts');

  // ── Transactions ──────────────────────────────────────────────────────────
  const txs = [
    {
      type: 'income', amount: 18000, categoryId: 'salary_me',
      icon: 'briefcase', recipient: 'Company', note: 'March salary',
      currency: '₪', date: new Date('2026-03-10T08:00:00Z'),
      account: 'account-001', isTransfer: false, tags: [],
      createdAt: new Date('2026-03-10T08:00:00Z'),
    },
    {
      type: 'expense', amount: 150, categoryId: 'food',
      icon: 'shopping-cart', recipient: 'Shufersal', note: 'Weekly groceries',
      currency: '₪', date: new Date('2026-03-25T10:30:00Z'),
      account: 'account-001', isTransfer: false, tags: [],
      createdAt: new Date('2026-03-25T10:30:00Z'),
    },
    {
      type: 'expense', amount: 85, categoryId: 'fuel',
      icon: 'droplet', recipient: 'Paz', note: 'Gas',
      currency: '₪', date: new Date('2026-03-24T14:00:00Z'),
      account: 'account-002', isTransfer: false, tags: [],
      createdAt: new Date('2026-03-24T14:00:00Z'),
    },
    {
      type: 'expense', amount: 320, categoryId: 'restaurant',
      icon: 'coffee', recipient: 'Café Nona', note: 'Family dinner',
      currency: '₪', date: new Date('2026-03-22T19:00:00Z'),
      account: 'account-002', isTransfer: false, tags: [],
      createdAt: new Date('2026-03-22T19:00:00Z'),
    },
    {
      type: 'transfer', amount: 2000, categoryId: 'transfer',
      icon: 'repeat', recipient: 'Visa Max', note: 'Credit card payment',
      currency: '₪', date: new Date('2026-03-20T12:00:00Z'),
      account: 'account-001', toAccount: 'account-002', isTransfer: true, tags: [],
      createdAt: new Date('2026-03-20T12:00:00Z'),
    },
  ];
  for (const tx of txs) {
    await base.collection('transactions').add(tx);
  }
  console.log('✓ Transactions');

  // ── Categories ────────────────────────────────────────────────────────────
  await base.collection('categories').doc('config').set({
    income: [
      { id: 'salary_me',     icon: 'briefcase',    color: '#22c55e' },
      { id: 'salary_spouse', icon: 'briefcase',    color: '#10b981' },
      { id: 'rental_income', icon: 'home',         color: '#059669' },
      { id: 'handyman',      icon: 'tool',         color: '#34d399' },
      { id: 'sales',         icon: 'package',      color: '#6ee7b7' },
      { id: 'other_income',  icon: 'plus-circle',  color: '#a7f3d0' },
    ],
    expense: [
      { id: 'food',          icon: 'shopping-cart',   color: '#ef4444' },
      { id: 'transport',     icon: 'navigation',      color: '#f97316' },
      { id: 'fuel',          icon: 'droplet',         color: '#f59e0b' },
      { id: 'insurance',     icon: 'shield',          color: '#eab308' },
      { id: 'phone',         icon: 'smartphone',      color: '#8b5cf6' },
      { id: 'utilities',     icon: 'zap',             color: '#3b82f6' },
      { id: 'health',        icon: 'heart',           color: '#ec4899' },
      { id: 'kids',          icon: 'smile',           color: '#f472b6' },
      { id: 'clothing',      icon: 'shopping-bag',    color: '#a855f7' },
      { id: 'entertainment', icon: 'film',            color: '#06b6d4' },
      { id: 'education',     icon: 'book-open',       color: '#14b8a6' },
      { id: 'rent',          icon: 'key',             color: '#dc2626' },
      { id: 'arnona',        icon: 'map-pin',         color: '#ef4444' },
      { id: 'vaad',          icon: 'users',           color: '#991b1b' },
      { id: 'mortgage',      icon: 'home',            color: '#b91c1c' },
      { id: 'restaurant',    icon: 'coffee',          color: '#e11d48' },
      { id: 'household',     icon: 'home',            color: '#7c3aed' },
      { id: 'electronics',   icon: 'cpu',             color: '#2563eb' },
      { id: 'cosmetics',     icon: 'scissors',        color: '#db2777' },
      { id: 'other',         icon: 'more-horizontal', color: '#6b7280' },
    ],
  });
  console.log('✓ Categories');

  // ── Budgets ───────────────────────────────────────────────────────────────
  await base.collection('budgets').doc('config').set({
    food:         2000,
    transport:     500,
    fuel:          800,
    restaurant:   1000,
    utilities:     600,
    health:        500,
    entertainment: 400,
  });
  console.log('✓ Budgets');

  // ── Investments ───────────────────────────────────────────────────────────
  const investments = [
    { name: 'Pension Alex',         type: 'pension',        amount: 180000, currency: '₪', provider: 'Menora',      isActive: true },
    { name: 'Pension Alexandra',    type: 'pension',        amount: 220000, currency: '₪', provider: 'Altshuler',   isActive: true },
    { name: 'Keren Hishtalmut Alex',type: 'hishtalmut',     amount: 95000,  currency: '₪', provider: 'Excellence',  isActive: true },
    { name: 'Kupat Gemel Alex',     type: 'gemel',          amount: 45000,  currency: '₪', provider: 'Migdal',      isActive: true },
    { name: 'Kupat Gemel Nicole',   type: 'gemel',          amount: 12000,  currency: '₪', provider: 'Phoenix',     isActive: true },
    { name: 'BitsOfGold',           type: 'crypto',         amount: 8500,   currency: '$', provider: 'BitsOfGold',  isActive: true },
  ];
  for (const inv of investments) {
    await base.collection('investments').add(inv);
  }
  console.log('✓ Investments');

  console.log(`\nDone! Open Firebase Console → Firestore to verify.\n`);
  console.log(`Next step: update userId in this script to the real Auth UID.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
