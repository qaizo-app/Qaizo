// __tests__/colors.test.js
// Тесты темы и конфигурации категорий/счетов

const { colors, applyTheme, getCurrentTheme, categoryConfig, accountTypeConfig } = require('../src/theme/colors');

describe('colors / theme', () => {
  afterEach(() => {
    applyTheme('dark'); // reset
  });

  // ─── applyTheme ────────────────────────────────
  test('default theme is dark', () => {
    expect(getCurrentTheme()).toBe('dark');
  });

  test('applyTheme("light") switches to light palette', () => {
    applyTheme('light');
    expect(getCurrentTheme()).toBe('light');
    expect(colors.bg).toBe('#eef0f5');
    expect(colors.text).toBe('#1a1e2e');
  });

  test('applyTheme("dark") switches back to dark palette', () => {
    applyTheme('light');
    applyTheme('dark');
    expect(getCurrentTheme()).toBe('dark');
    expect(colors.bg).toBe('#0a0e1a');
    expect(colors.text).toBe('#f1f5f9');
  });

  test('colors object is mutated in place (same reference)', () => {
    const ref = colors;
    applyTheme('light');
    expect(ref).toBe(colors);
    expect(ref.bg).toBe('#eef0f5');
  });

  // ─── color properties ──────────────────────────
  test('dark palette has all required keys', () => {
    applyTheme('dark');
    const requiredKeys = ['bg', 'bg2', 'card', 'green', 'red', 'text', 'textSecondary', 'divider', 'overlay'];
    requiredKeys.forEach(key => {
      expect(colors[key]).toBeDefined();
    });
  });

  test('light palette has all required keys', () => {
    applyTheme('light');
    const requiredKeys = ['bg', 'bg2', 'card', 'green', 'red', 'text', 'textSecondary', 'divider', 'overlay'];
    requiredKeys.forEach(key => {
      expect(colors[key]).toBeDefined();
    });
  });

  // ─── AMOLED ────────────────────────────────────
  test('applyTheme("amoled") uses pure black backgrounds', () => {
    applyTheme('amoled');
    expect(getCurrentTheme()).toBe('amoled');
    expect(colors.bg).toBe('#000000');
    expect(colors.card).toBe('#101010');
  });

  test('AMOLED keeps dark text palette for readability', () => {
    applyTheme('amoled');
    expect(colors.text).toBe('#f1f5f9');
  });

  test('AMOLED palette has all required keys', () => {
    applyTheme('amoled');
    const requiredKeys = ['bg', 'bg2', 'card', 'green', 'red', 'text', 'textSecondary', 'divider', 'overlay'];
    requiredKeys.forEach(key => {
      expect(colors[key]).toBeDefined();
    });
  });

  // ─── categoryConfig ────────────────────────────
  test('categoryConfig has food, transport, salary_me, transfer', () => {
    expect(categoryConfig.food).toBeDefined();
    expect(categoryConfig.food.icon).toBe('shopping-cart');
    expect(categoryConfig.transport).toBeDefined();
    expect(categoryConfig.salary_me).toBeDefined();
    expect(categoryConfig.transfer).toBeDefined();
  });

  test('every category has icon and color', () => {
    Object.entries(categoryConfig).forEach(([key, cfg]) => {
      expect(cfg.icon).toBeTruthy();
      expect(cfg.color).toMatch(/^#/);
    });
  });

  // ─── accountTypeConfig ─────────────────────────
  test('accountTypeConfig has bank, cash, credit, crypto', () => {
    expect(accountTypeConfig.bank).toBeDefined();
    expect(accountTypeConfig.cash).toBeDefined();
    expect(accountTypeConfig.credit).toBeDefined();
    expect(accountTypeConfig.crypto).toBeDefined();
  });

  test('every account type has icon and color', () => {
    Object.entries(accountTypeConfig).forEach(([key, cfg]) => {
      expect(cfg.icon).toBeTruthy();
      expect(cfg.color).toMatch(/^#/);
    });
  });
});
