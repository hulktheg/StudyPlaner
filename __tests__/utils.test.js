'use strict';

/**
 * Unit tests for pure utility functions exported from app.js.
 * No DOM interaction is required here; we only rely on the module
 * being loadable in the jsdom environment set up by jest.setup.js.
 */

let app;

beforeEach(() => {
  app = require('../app.js');
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(app.escapeHtml('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(app.escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(app.escapeHtml(undefined)).toBe('');
  });

  it('escapes ampersands', () => {
    expect(app.escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than and greater-than signs', () => {
    expect(app.escapeHtml('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapes double quotes', () => {
    expect(app.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(app.escapeHtml("it's")).toBe('it&#039;s');
  });

  it('escapes all special HTML characters together', () => {
    expect(app.escapeHtml('<script>alert("xss & hack")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss &amp; hack&quot;)&lt;/script&gt;'
    );
  });

  it('does not modify plain text', () => {
    expect(app.escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('converts non-string input to string before escaping', () => {
    expect(app.escapeHtml(42)).toBe('42');
    expect(app.escapeHtml(true)).toBe('true');
  });

  it('double-escapes already-escaped entities', () => {
    // The function escapes raw characters; pre-escaped text gets re-escaped
    expect(app.escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

// ---------------------------------------------------------------------------
// dateOnly
// ---------------------------------------------------------------------------
describe('dateOnly', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    expect(app.dateOnly(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the correct UTC date', () => {
    expect(app.dateOnly(new Date('2024-01-01T12:00:00.000Z'))).toBe('2024-01-01');
  });

  it('handles end-of-year dates', () => {
    expect(app.dateOnly(new Date('2023-12-31T12:00:00.000Z'))).toBe('2023-12-31');
  });
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------
describe('addDays', () => {
  it('adds a positive number of days', () => {
    expect(app.addDays('2024-01-10', 5)).toBe('2024-01-15');
  });

  it('handles month rollover', () => {
    expect(app.addDays('2024-01-28', 5)).toBe('2024-02-02');
  });

  it('handles year rollover', () => {
    expect(app.addDays('2023-12-30', 3)).toBe('2024-01-02');
  });

  it('returns the same date when adding 0 days', () => {
    expect(app.addDays('2024-06-15', 0)).toBe('2024-06-15');
  });

  it('subtracts days when n is negative', () => {
    expect(app.addDays('2024-06-15', -3)).toBe('2024-06-12');
  });

  it('handles leap-year February correctly', () => {
    expect(app.addDays('2024-02-28', 1)).toBe('2024-02-29'); // 2024 is a leap year
    expect(app.addDays('2024-02-28', 2)).toBe('2024-03-01');
  });

  it('handles non-leap-year February correctly', () => {
    expect(app.addDays('2023-02-28', 1)).toBe('2023-03-01'); // 2023 is not a leap year
  });
});

// ---------------------------------------------------------------------------
// daysUntil
// ---------------------------------------------------------------------------
describe('daysUntil', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Use UTC noon to avoid any timezone edge-cases
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 for today', () => {
    expect(app.daysUntil('2024-06-15')).toBe(0);
  });

  it('returns 1 for tomorrow', () => {
    expect(app.daysUntil('2024-06-16')).toBe(1);
  });

  it('returns -1 for yesterday', () => {
    expect(app.daysUntil('2024-06-14')).toBe(-1);
  });

  it('returns correct count for a future date', () => {
    expect(app.daysUntil('2024-06-20')).toBe(5);
  });

  it('returns correct negative count for a past date', () => {
    expect(app.daysUntil('2024-06-10')).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// dueBadgeLabel
// ---------------------------------------------------------------------------
describe('dueBadgeLabel', () => {
  it('returns "Heute" for 0 days', () => {
    expect(app.dueBadgeLabel(0)).toBe('Heute');
  });

  it('returns "Morgen" for 1 day', () => {
    expect(app.dueBadgeLabel(1)).toBe('Morgen');
  });

  it('returns "in X Tagen" for future days', () => {
    expect(app.dueBadgeLabel(5)).toBe('in 5 Tagen');
    expect(app.dueBadgeLabel(14)).toBe('in 14 Tagen');
  });

  it('returns singular "Tag" for exactly 1 day overdue', () => {
    expect(app.dueBadgeLabel(-1)).toBe('Überfällig (1 Tag)');
  });

  it('returns plural "Tage" for multiple days overdue', () => {
    expect(app.dueBadgeLabel(-2)).toBe('Überfällig (2 Tage)');
    expect(app.dueBadgeLabel(-7)).toBe('Überfällig (7 Tage)');
  });
});

// ---------------------------------------------------------------------------
// priorityLabel
// ---------------------------------------------------------------------------
describe('priorityLabel', () => {
  it('returns the high-priority label', () => {
    expect(app.priorityLabel('high')).toBe('🔴 Hoch');
  });

  it('returns the medium-priority label', () => {
    expect(app.priorityLabel('medium')).toBe('🟡 Mittel');
  });

  it('returns the low-priority label for "low"', () => {
    expect(app.priorityLabel('low')).toBe('🟢 Niedrig');
  });

  it('defaults to the low-priority label for unknown values', () => {
    expect(app.priorityLabel('')).toBe('🟢 Niedrig');
    expect(app.priorityLabel(undefined)).toBe('🟢 Niedrig');
    expect(app.priorityLabel('unknown')).toBe('🟢 Niedrig');
  });
});

// ---------------------------------------------------------------------------
// getUrgency
// ---------------------------------------------------------------------------
describe('getUrgency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty string for empty/falsy input', () => {
    expect(app.getUrgency('')).toBe('');
    expect(app.getUrgency(null)).toBe('');
    expect(app.getUrgency(undefined)).toBe('');
  });

  it('returns "overdue" for past dates', () => {
    expect(app.getUrgency('2024-06-14')).toBe('overdue');
    expect(app.getUrgency('2024-01-01')).toBe('overdue');
  });

  it('returns "urgent" for today', () => {
    expect(app.getUrgency('2024-06-15')).toBe('urgent');
  });

  it('returns "urgent" for tomorrow', () => {
    expect(app.getUrgency('2024-06-16')).toBe('urgent');
  });

  it('returns empty string for dates two or more days in the future', () => {
    expect(app.getUrgency('2024-06-17')).toBe('');
    expect(app.getUrgency('2024-12-31')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty string for empty/falsy input', () => {
    expect(app.formatDate('')).toBe('');
    expect(app.formatDate(null)).toBe('');
    expect(app.formatDate(undefined)).toBe('');
  });

  it('returns "Heute" for today\'s date', () => {
    expect(app.formatDate('2024-06-15')).toBe('Heute');
  });

  it('returns "Morgen" for tomorrow\'s date', () => {
    expect(app.formatDate('2024-06-16')).toBe('Morgen');
  });

  it('returns an overdue label for past dates', () => {
    const result = app.formatDate('2024-06-10');
    expect(result).toContain('Überfällig');
  });

  it('returns a non-empty string for future dates beyond tomorrow', () => {
    const result = app.formatDate('2024-06-25');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('Heute');
    expect(result).not.toBe('Morgen');
    expect(result).not.toContain('Überfällig');
  });
});
