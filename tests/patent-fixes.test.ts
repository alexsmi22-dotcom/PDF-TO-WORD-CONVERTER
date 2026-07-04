import { applyPatentFixes } from '../src/wizard/patent-fixes.js';

const fix = (s: string): string => applyPatentFixes(s).text;

describe('patent-fixes', () => {
  it('corrects a misread kind code after a patent number', () => {
    expect(fix('(10) Patent No.: US 6,421,675 BI')).toBe('(10) Patent No.: US 6,421,675 B1');
    expect(fix('US 6,421,675 Bl')).toBe('US 6,421,675 B1');
    expect(fix('US6,123,456 AI')).toBe('US6,123,456 A1');
  });

  it('leaves valid kind codes and unrelated text alone', () => {
    expect(fix('US 6,421,675 B2')).toBe('US 6,421,675 B2');
    expect(fix('US 6,421,675 A1')).toBe('US 6,421,675 A1');
    expect(fix('The invention relates to Business methods')).toBe(
      'The invention relates to Business methods',
    );
  });

  it('fixes the patent-term-adjustment boilerplate', () => {
    expect(fix('adjusted under 35 U.S.C. 154(b) by O days.')).toBe(
      'adjusted under 35 U.S.C. 154(b) by 0 days.',
    );
    expect(fix('extended by O day')).toBe('extended by 0 day');
  });

  it('does not touch a lone O elsewhere (avoids false positives)', () => {
    expect(fix('the O-ring seal')).toBe('the O-ring seal');
    expect(fix('type O blood')).toBe('type O blood');
  });

  it('reports how many fixes were made', () => {
    const r = applyPatentFixes('US 6,421,675 BI ... by O days');
    expect(r.count).toBe(2);
  });
});
