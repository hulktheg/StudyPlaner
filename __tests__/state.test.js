'use strict';

/**
 * Tests for state persistence (saveState / loadState) and the
 * getWeekRange statistics helper.
 */

let app;

beforeEach(() => {
  app = require('../app.js');
});

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS sanity check
// ---------------------------------------------------------------------------
describe('DEFAULT_SETTINGS', () => {
  it('contains all expected keys with sensible defaults', () => {
    const s = app.DEFAULT_SETTINGS;
    expect(s.periods).toBe(8);
    expect(s.startHour).toBe(8);
    expect(s.periodDuration).toBe(45);
    expect(s.showSaturday).toBe(false);
    expect(s.abWeek).toBe(false);
    expect(s.notificationsEnabled).toBe(true);
    expect(s.reminderDays).toBe(1);
    expect(s.pomodoroWork).toBe(25);
    expect(s.pomodoroBreak).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// saveState
// ---------------------------------------------------------------------------
describe('saveState', () => {
  it('writes state to localStorage under key "studyplaner_v3"', () => {
    app.saveState();
    expect(localStorage.getItem('studyplaner_v3')).not.toBeNull();
  });

  it('persisted data is valid JSON', () => {
    app.saveState();
    const raw = localStorage.getItem('studyplaner_v3');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('does not persist transient fields editingCell and editingTaskId', () => {
    app.setState({ editingCell: { period: 0, dayIdx: 1 }, editingTaskId: 'task-99' });
    app.saveState();
    const saved = JSON.parse(localStorage.getItem('studyplaner_v3'));
    expect(saved.editingCell).toBeUndefined();
    expect(saved.editingTaskId).toBeUndefined();
  });

  it('persists tasks array', () => {
    const tasks = [
      { id: '1', desc: 'Math homework', notes: '', deadline: '2024-06-20', priority: 'high', done: false, subjectId: '', createdAt: '2024-06-01T00:00:00.000Z', doneAt: null },
    ];
    app.setState({ tasks });
    app.saveState();
    const saved = JSON.parse(localStorage.getItem('studyplaner_v3'));
    expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].desc).toBe('Math homework');
  });

  it('persists subjects array', () => {
    const subjects = [{ id: '42', name: 'Physics', color: '#667eea', grade: '2' }];
    app.setState({ subjects });
    app.saveState();
    const saved = JSON.parse(localStorage.getItem('studyplaner_v3'));
    expect(saved.subjects).toHaveLength(1);
    expect(saved.subjects[0].name).toBe('Physics');
  });

  it('persists theme preference', () => {
    app.setState({ theme: 'dark' });
    app.saveState();
    const saved = JSON.parse(localStorage.getItem('studyplaner_v3'));
    expect(saved.theme).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------
describe('loadState', () => {
  it('restores tasks from localStorage', () => {
    const data = {
      tasks: [{ id: '5', desc: 'Biology report', notes: '', deadline: '', priority: 'low', done: false, subjectId: '', createdAt: '', doneAt: null }],
      subjects: [],
      timetable: {},
      timetableB: {},
      theme: 'light',
      settings: { ...app.DEFAULT_SETTINGS },
    };
    localStorage.setItem('studyplaner_v3', JSON.stringify(data));
    app.loadState();
    expect(app.getState().tasks).toHaveLength(1);
    expect(app.getState().tasks[0].desc).toBe('Biology report');
  });

  it('merges missing settings keys with defaults', () => {
    const data = {
      tasks: [],
      subjects: [],
      timetable: {},
      timetableB: {},
      theme: 'light',
      settings: { periods: 6 }, // only partial settings
    };
    localStorage.setItem('studyplaner_v3', JSON.stringify(data));
    app.loadState();
    const s = app.getState().settings;
    expect(s.periods).toBe(6);          // from saved data
    expect(s.startHour).toBe(8);        // from DEFAULT_SETTINGS
    expect(s.pomodoroWork).toBe(25);    // from DEFAULT_SETTINGS
  });

  it('does not throw when localStorage is empty', () => {
    expect(() => app.loadState()).not.toThrow();
  });

  it('does not throw when localStorage contains corrupt JSON', () => {
    localStorage.setItem('studyplaner_v3', 'NOT_VALID_JSON{{{');
    // loadState catches the SyntaxError internally and logs a console.warn
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => app.loadState()).not.toThrow();
    warnSpy.mockRestore();
  });

  it('migrates data from legacy v2 key when v3 is absent', () => {
    const v2data = {
      tasks: [{ id: '7', desc: 'Old task', deadline: '', priority: 'medium', done: false, subjectId: '', createdAt: '' }],
      subjects: [{ id: '8', name: 'History', color: '#ed64a6' }],
      timetable: {},
      theme: 'dark',
    };
    localStorage.setItem('studyplaner_v2', JSON.stringify(v2data));
    app.loadState();
    const s = app.getState();
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0].desc).toBe('Old task');
    // v2 migration adds a default `notes` field
    expect(s.tasks[0].notes).toBe('');
    expect(s.subjects).toHaveLength(1);
    expect(s.theme).toBe('dark');
  });

  it('does not overwrite v3 data with v2 when both keys exist', () => {
    const v3data = { tasks: [{ id: '1', desc: 'v3 task' }], subjects: [], timetable: {}, timetableB: {}, theme: 'light', settings: {} };
    const v2data = { tasks: [{ id: '2', desc: 'v2 task' }], subjects: [], timetable: {} };
    localStorage.setItem('studyplaner_v3', JSON.stringify(v3data));
    localStorage.setItem('studyplaner_v2', JSON.stringify(v2data));
    app.loadState();
    expect(app.getState().tasks[0].desc).toBe('v3 task');
  });
});

// ---------------------------------------------------------------------------
// getWeekRange
// ---------------------------------------------------------------------------
describe('getWeekRange', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Use a Monday to make assertions straightforward
    jest.setSystemTime(new Date('2024-06-17T12:00:00.000Z')); // Monday 17 June 2024
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('current-week range starts on Monday and ends on Sunday', () => {
    const { start, end } = app.getWeekRange(0);
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0);   // Sunday
  });

  it('current-week range spans from Monday 00:00 to Sunday 23:59:59', () => {
    const { start, end } = app.getWeekRange(0);
    // Mon 00:00:00 → Sun 23:59:59.999  ≈  7 days  (604 799 999 ms)
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    expect(end - start + 1).toBe(msInWeek);
  });

  it('last-week range is 7 days before the current week', () => {
    const cur  = app.getWeekRange(0);
    const last = app.getWeekRange(1);
    expect(cur.start - last.start).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('returns different start dates for different weeksAgo values', () => {
    const w0 = app.getWeekRange(0);
    const w1 = app.getWeekRange(1);
    const w2 = app.getWeekRange(2);
    expect(w0.start).not.toEqual(w1.start);
    expect(w1.start).not.toEqual(w2.start);
  });

  it('works correctly when today is Sunday', () => {
    jest.setSystemTime(new Date('2024-06-16T12:00:00.000Z')); // Sunday
    const { start, end } = app.getWeekRange(0);
    expect(start.getDay()).toBe(1); // Monday of that week
    expect(end.getDay()).toBe(0);   // Sunday of that week
    // start should be Monday 10 June 2024
    expect(start.getDate()).toBe(10);
    expect(end.getDate()).toBe(16);
  });
});
