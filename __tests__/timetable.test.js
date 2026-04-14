'use strict';

/**
 * Tests for timetable helper functions and the timetable renderer.
 */

let app;

beforeEach(() => {
  app = require('../app.js');
});

// ---------------------------------------------------------------------------
// getTimetableData
// ---------------------------------------------------------------------------
describe('getTimetableData', () => {
  it('returns state.timetable when currentWeek is "A"', () => {
    const timetable = { '0-0': 'sub1' };
    app.setState({ timetable, timetableB: {}, currentWeek: 'A' });
    expect(app.getTimetableData()).toBe(app.getState().timetable);
  });

  it('returns state.timetableB when currentWeek is "B"', () => {
    const timetableB = { '1-2': 'sub2' };
    app.setState({ timetable: {}, timetableB, currentWeek: 'B' });
    expect(app.getTimetableData()).toBe(app.getState().timetableB);
  });
});

// ---------------------------------------------------------------------------
// getActiveDays
// ---------------------------------------------------------------------------
describe('getActiveDays', () => {
  it('returns 5 days when showSaturday is false', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, showSaturday: false } });
    expect(app.getActiveDays()).toHaveLength(5);
    expect(app.getActiveDays()).not.toContain('Sa');
  });

  it('returns 6 days when showSaturday is true', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, showSaturday: true } });
    const days = app.getActiveDays();
    expect(days).toHaveLength(6);
    expect(days[5]).toBe('Sa');
  });
});

// ---------------------------------------------------------------------------
// getActiveFullDays
// ---------------------------------------------------------------------------
describe('getActiveFullDays', () => {
  it('returns 5 full day names by default', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, showSaturday: false } });
    expect(app.getActiveFullDays()).toHaveLength(5);
    expect(app.getActiveFullDays()).not.toContain('Samstag');
  });

  it('includes Samstag when showSaturday is true', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, showSaturday: true } });
    const days = app.getActiveFullDays();
    expect(days).toHaveLength(6);
    expect(days[5]).toBe('Samstag');
  });
});

// ---------------------------------------------------------------------------
// getTodayColIndex
// ---------------------------------------------------------------------------
describe('getTodayColIndex', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 for Monday', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-17T12:00:00.000Z')); // Monday
    expect(app.getTodayColIndex()).toBe(0);
  });

  it('returns 4 for Friday', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-21T12:00:00.000Z')); // Friday
    expect(app.getTodayColIndex()).toBe(4);
  });

  it('returns 5 for Saturday', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-22T12:00:00.000Z')); // Saturday
    expect(app.getTodayColIndex()).toBe(5);
  });

  it('returns -1 for Sunday', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-23T12:00:00.000Z')); // Sunday
    expect(app.getTodayColIndex()).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// renderTimetable – basic DOM output
// ---------------------------------------------------------------------------
describe('renderTimetable', () => {
  it('renders the correct number of period rows', () => {
    app.setState({
      settings: { ...app.DEFAULT_SETTINGS, periods: 5, showSaturday: false },
      timetable: {},
      timetableB: {},
      currentWeek: 'A',
      subjects: [],
    });
    app.renderTimetable();
    // Each row has: 1 time-label + 5 day cells = 6 elements per row
    // Plus 1 header row (corner + 5 day names)
    const grid = document.getElementById('timetable');
    expect(grid).not.toBeNull();
    // 6 header cells (corner + 5 days) + 5 rows × 6 cells = 36
    expect(grid.children.length).toBe(6 + 5 * 6);
  });

  it('renders Saturday column when showSaturday is true', () => {
    app.setState({
      settings: { ...app.DEFAULT_SETTINGS, periods: 4, showSaturday: true },
      timetable: {},
      timetableB: {},
      currentWeek: 'A',
      subjects: [],
    });
    app.renderTimetable();
    const grid = document.getElementById('timetable');
    // 7 header cells + 4 rows × 7 cells
    expect(grid.children.length).toBe(7 + 4 * 7);
  });

  it('fills a cell when a subject is assigned to a slot', () => {
    app.setState({
      settings: { ...app.DEFAULT_SETTINGS, periods: 3, showSaturday: false },
      subjects: [{ id: 'sub1', name: 'Math', color: '#667eea', grade: '' }],
      timetable: { '0-0': 'sub1' }, // period 0, day 0
      timetableB: {},
      currentWeek: 'A',
    });
    app.renderTimetable();
    const filledCells = document.querySelectorAll('.timetable-cell.filled');
    expect(filledCells.length).toBe(1);
    expect(filledCells[0].textContent).toBe('Math');
  });

  it('uses timetableB data when currentWeek is B', () => {
    app.setState({
      settings: { ...app.DEFAULT_SETTINGS, periods: 3, showSaturday: false },
      subjects: [{ id: 'subB', name: 'Physics', color: '#ed64a6', grade: '' }],
      timetable:  {},
      timetableB: { '1-1': 'subB' },
      currentWeek: 'B',
    });
    app.renderTimetable();
    const filledCells = document.querySelectorAll('.timetable-cell.filled');
    expect(filledCells.length).toBe(1);
    expect(filledCells[0].textContent).toBe('Physics');
  });
});

// ---------------------------------------------------------------------------
// renderMiniCalendar
// ---------------------------------------------------------------------------
describe('renderMiniCalendar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the calendar without throwing', () => {
    app.setState({ tasks: [], subjects: [] });
    expect(() => app.renderMiniCalendar()).not.toThrow();
  });

  it('renders the correct month name', () => {
    app.setState({ tasks: [], subjects: [] });
    app.renderMiniCalendar();
    const cal = document.getElementById('miniCalendar');
    expect(cal.textContent).toContain('Juni');
  });

  it('marks today with the cal-today class', () => {
    app.setState({ tasks: [], subjects: [] });
    app.renderMiniCalendar();
    const todayEl = document.querySelector('.cal-today');
    expect(todayEl).not.toBeNull();
    expect(todayEl.textContent).toBe('15');
  });

  it('marks days with tasks with the cal-has-tasks class', () => {
    app.setState({
      tasks: [
        {
          id: '1', desc: 'Due today', deadline: '2024-06-15',
          done: false, priority: 'high', notes: '', subjectId: '', createdAt: '', doneAt: null,
        },
      ],
      subjects: [],
    });
    app.renderMiniCalendar();
    const taskDay = document.querySelector('.cal-has-tasks');
    expect(taskDay).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderSubjectOverview
// ---------------------------------------------------------------------------
describe('renderSubjectOverview', () => {
  it('shows an empty-state message when no subjects exist', () => {
    app.setState({ subjects: [], tasks: [] });
    // Make the body visible so renderSubjectOverview doesn't short-circuit
    const body = document.getElementById('subjectOverviewBody');
    body.hidden = false;
    app.renderSubjectOverview();
    expect(body.textContent).toContain('Keine Fächer vorhanden');
  });

  it('renders a row for each subject with task counts', () => {
    app.setState({
      subjects: [
        { id: 's1', name: 'Art',   color: '#ed8936', grade: '' },
        { id: 's2', name: 'Music', color: '#38b2ac', grade: '' },
      ],
      tasks: [
        { id: '1', subjectId: 's1', done: false, desc: 't', notes: '', deadline: '', priority: 'low', createdAt: '', doneAt: null },
        { id: '2', subjectId: 's1', done: true,  desc: 't', notes: '', deadline: '', priority: 'low', createdAt: '', doneAt: null },
      ],
    });
    const body = document.getElementById('subjectOverviewBody');
    body.hidden = false;
    app.renderSubjectOverview();
    const rows = body.querySelectorAll('.subject-overview-row');
    expect(rows.length).toBe(2);
    // First row (Art) should mention "1 offen / 2 gesamt"
    expect(rows[0].textContent).toContain('1 offen');
    expect(rows[0].textContent).toContain('2 gesamt');
  });
});
