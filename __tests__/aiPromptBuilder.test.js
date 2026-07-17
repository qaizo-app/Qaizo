const { buildSmartPrompt } = require('../src/services/ai/promptBuilder');

const base = {
  text: 'кофе 28', lang: 'ru', currency: 'ILS',
  customCategories: [], examples: [], accounts: [], projects: [],
};

describe('buildSmartPrompt', () => {
  test('contains the input, built-in category anchors and output contract', () => {
    const p = buildSmartPrompt(base);
    expect(p).toContain('"кофе 28"');
    expect(p).toContain('food');
    expect(p).toContain('restaurant');
    expect(p).toContain('OUTPUT FORMAT');
  });

  test('custom categories are listed with their names and kinds', () => {
    const p = buildSmartPrompt({ ...base, customCategories: [
      { id: 'cat_abc', name: 'Детское пособие', kind: 'income' },
      { id: 'cat_def', name: 'חוגים לילדים', kind: 'expense' },
    ]});
    expect(p).toContain('cat_abc');
    expect(p).toContain('Детское пособие');
    expect(p).toContain('cat_def');
    expect(p).toContain('חוגים לילדים');
  });

  test('examples section appears, is capped at 30 and carries no digits', () => {
    const examples = Array.from({ length: 40 }, (_, i) => ({ text: `пример номер ${i}`, categoryId: 'food' }));
    const p = buildSmartPrompt({ ...base, examples });
    const section = p.slice(p.indexOf('USER HISTORY EXAMPLES'));
    const lines = section.split('\n').filter(l => l.trim().startsWith('"'));
    expect(lines.length).toBe(30);
    for (const l of lines) expect(l).not.toMatch(/\d/);
  });

  test('no examples → no history section', () => {
    expect(buildSmartPrompt(base)).not.toContain('USER HISTORY EXAMPLES');
  });

  test('accounts and projects sections appear only when provided', () => {
    const p = buildSmartPrompt({ ...base,
      accounts: [{ id: 'a1', name: 'Visa', type: 'credit' }],
      projects: [{ id: 'p1', name: 'Ремонт' }],
    });
    expect(p).toContain('USER ACCOUNTS');
    expect(p).toContain('USER PROJECTS');
    expect(buildSmartPrompt(base)).not.toContain('USER ACCOUNTS');
  });

  test('HE input flows through untouched', () => {
    const p = buildSmartPrompt({ ...base, text: 'דלק פז 280', lang: 'he' });
    expect(p).toContain('"דלק פז 280"');
    expect(p).toContain('User language: he');
  });
});
