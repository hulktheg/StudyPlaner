'use strict';

/**
 * Smoke tests for renderAll / init and subject-management helpers.
 * These tests increase coverage of the render pipeline and the
 * subject CRUD operations (getSubject is already tested in tasks.test.js).
 */

let app;

beforeEach(() => {
  app = require('../app.js');
});

// ---------------------------------------------------------------------------
// renderAll smoke tests
// ---------------------------------------------------------------------------
describe('renderAll', () => {
  it('runs without throwing with default (empty) state', () => {
    expect(() => app.renderAll()).not.toThrow();
  });

  it('runs without throwing with populated state', () => {
    app.setState({
      theme: 'light',
      subjects: [{ id: 's1', name: 'Math', color: '#667eea', grade: '1' }],
      tasks: [
        {
          id: 't1', desc: 'Homework', notes: '', deadline: '2099-12-31',
          priority: 'high', done: false, subjectId: 's1',
          createdAt: new Date().toISOString(), doneAt: null,
        },
      ],
      timetable: { '0-0': 's1' },
      timetableB: {},
      currentWeek: 'A',
      filter: 'all',
      search: '',
      settings: { ...app.DEFAULT_SETTINGS },
    });
    expect(() => app.renderAll()).not.toThrow();
  });

  it('runs without throwing with dark theme', () => {
    app.setState({ theme: 'dark', subjects: [], tasks: [], settings: { ...app.DEFAULT_SETTINGS } });
    expect(() => app.renderAll()).not.toThrow();
    expect(document.body.dataset.theme).toBe('dark');
  });

  it('updates the theme icon for light mode', () => {
    app.setState({ theme: 'light', subjects: [], tasks: [], settings: { ...app.DEFAULT_SETTINGS } });
    app.renderAll();
    expect(document.getElementById('themeIcon').textContent).toBe('🌙');
  });

  it('updates the theme icon for dark mode', () => {
    app.setState({ theme: 'dark', subjects: [], tasks: [], settings: { ...app.DEFAULT_SETTINGS } });
    app.renderAll();
    expect(document.getElementById('themeIcon').textContent).toBe('☀️');
  });

  it('populates colour swatches', () => {
    app.renderAll();
    const swatches = document.querySelectorAll('.color-swatch');
    expect(swatches.length).toBe(app.SUBJECT_COLORS.length);
  });
});

// ---------------------------------------------------------------------------
// init smoke tests
// ---------------------------------------------------------------------------
describe('init', () => {
  it('runs without throwing with an empty localStorage', () => {
    expect(() => app.init()).not.toThrow();
  });

  it('restores saved state on init', () => {
    const data = {
      tasks: [{ id: '99', desc: 'Saved task', notes: '', deadline: '', priority: 'low', done: false, subjectId: '', createdAt: '', doneAt: null }],
      subjects: [],
      timetable: {},
      timetableB: {},
      theme: 'light',
      settings: { ...app.DEFAULT_SETTINGS },
      filter: 'all',
      search: '',
      currentWeek: 'A',
      selectedColor: app.SUBJECT_COLORS[0],
    };
    localStorage.setItem('studyplaner_v3', JSON.stringify(data));
    app.init();
    expect(app.getState().tasks).toHaveLength(1);
    expect(app.getState().tasks[0].desc).toBe('Saved task');
  });
});

// ---------------------------------------------------------------------------
// renderStats smoke test (uses canvas mock)
// ---------------------------------------------------------------------------
describe('renderStats', () => {
  it('runs without throwing when stats body is visible', () => {
    const statsBody = document.getElementById('statsBody');
    statsBody.hidden = false;

    app.setState({
      tasks: [
        { id: '1', desc: 'Done task', done: true, doneAt: new Date().toISOString(), deadline: '2024-06-01', priority: 'low', notes: '', subjectId: '', createdAt: '' },
        { id: '2', desc: 'Open task', done: false, doneAt: null, deadline: '',      priority: 'medium', notes: '', subjectId: '', createdAt: '' },
      ],
      subjects: [{ id: 's1', name: 'Math', color: '#667eea', grade: '' }],
    });

    expect(() => app.renderStats()).not.toThrow();
  });

  it('does nothing when stats body is hidden', () => {
    const statsBody = document.getElementById('statsBody');
    statsBody.hidden = true;
    // Should return early and not touch the DOM
    expect(() => app.renderStats()).not.toThrow();
    expect(document.getElementById('statsSubjectList').innerHTML).toBe('');
  });
});
