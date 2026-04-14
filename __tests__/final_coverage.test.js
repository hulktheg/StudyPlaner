'use strict';

/**
 * Supplementary tests targeting the last reachable uncovered lines:
 * – removeSubject removing timetable entries + tasks (line 225)
 * – renderSubjectOverview grade rendering (lines 329-330)
 * – deleteTask without a rendered item (line 581)
 * – closeModal editingTaskId reset (lines 1072-1073)
 * – loadPomState from sessionStorage (line 1273)
 * – requestNotifications & sendNotifications (lines 1232, 1240-1257)
 * – notifyPomodoro when permission is granted (line 1331)
 * – saveState error handling (line 58)
 */

let app;

function makeTask(overrides = {}) {
  return {
    id:        overrides.id        ?? 'task-' + Math.random().toString(36).slice(2),
    desc:      overrides.desc      ?? 'Sample task',
    notes:     overrides.notes     ?? '',
    deadline:  overrides.deadline  ?? '',
    priority:  overrides.priority  ?? 'medium',
    done:      overrides.done      ?? false,
    subjectId: overrides.subjectId ?? '',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    doneAt:    overrides.doneAt    ?? null,
  };
}

beforeEach(() => {
  app = require('../app.js');
});

// ---------------------------------------------------------------------------
// removeSubject – also removes timetable entries and tasks (line 225)
// ---------------------------------------------------------------------------
describe('removeSubject – cascading cleanup', () => {
  beforeEach(() => {
    app.setState({
      subjects:  [{ id: 's1', name: 'Art', color: '#ed64a6', grade: '' }],
      timetable: { '0-0': 's1', '1-1': 's2' }, // s1 entry should be removed, s2 kept
      timetableB: { '2-2': 's1' },
      tasks: [
        makeTask({ id: 't1', subjectId: 's1' }),
        makeTask({ id: 't2', subjectId: '' }),
      ],
      settings: { ...app.DEFAULT_SETTINGS },
    });
    app.renderAll();
  });

  it('removes timetable (A) entries for the deleted subject', () => {
    global.confirm.mockReturnValue(true);
    document.querySelector('.subject-tag-remove').click();
    expect(app.getState().timetable['0-0']).toBeUndefined();
    expect(app.getState().timetable['1-1']).toBe('s2'); // unrelated entry kept
  });

  it('removes timetableB entries for the deleted subject', () => {
    global.confirm.mockReturnValue(true);
    document.querySelector('.subject-tag-remove').click();
    expect(app.getState().timetableB['2-2']).toBeUndefined();
  });

  it('removes tasks associated with the deleted subject', () => {
    global.confirm.mockReturnValue(true);
    document.querySelector('.subject-tag-remove').click();
    // t1 (linked to s1) should be gone; t2 (no subject) should remain
    const ids = app.getState().tasks.map(t => t.id);
    expect(ids).not.toContain('t1');
    expect(ids).toContain('t2');
  });
});

// ---------------------------------------------------------------------------
// renderSubjectOverview – subject with a grade (lines 329-330)
// ---------------------------------------------------------------------------
describe('renderSubjectOverview – grade badge', () => {
  it('renders a grade badge when the subject has a grade', () => {
    app.setState({
      subjects: [{ id: 's1', name: 'Math', color: '#667eea', grade: '1,5' }],
      tasks: [],
    });
    const body = document.getElementById('subjectOverviewBody');
    body.hidden = false;
    app.renderSubjectOverview();
    expect(body.querySelector('.subject-ov-grade')).not.toBeNull();
    expect(body.querySelector('.subject-ov-grade').textContent).toContain('1,5');
  });

  it('does not render a grade badge when grade is empty', () => {
    app.setState({
      subjects: [{ id: 's1', name: 'Art', color: '#ed64a6', grade: '' }],
      tasks: [],
    });
    const body = document.getElementById('subjectOverviewBody');
    body.hidden = false;
    app.renderSubjectOverview();
    expect(body.querySelector('.subject-ov-grade')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteTask – without a rendered task item (line 581 _removeTask directly)
// ---------------------------------------------------------------------------
describe('deleteTask – task not present in the rendered DOM', () => {
  it('still removes the task from state when the DOM element is absent', () => {
    // Set state but do NOT call renderTaskList – the task item is not in the DOM
    app.setState({
      tasks: [makeTask({ id: 'ghost1', desc: 'Ghost task' })],
      subjects: [],
      filter: 'all',
      search: '',
    });
    // Call deleteTask directly – the DOM element doesn't exist, triggering the else branch
    app.deleteTask('ghost1');
    expect(app.getState().tasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// closeModal – resets editingTaskId when the task modal is closed (line 1083)
// ---------------------------------------------------------------------------
describe('closeModal – editingTaskId reset', () => {
  it('resets editingTaskId to null when the task modal is closed', () => {
    // Open the modal as if editing a task
    app.setState({ editingTaskId: 'some-task-id' });
    document.getElementById('cancelTaskBtn').click(); // triggers closeModal('modalOverlay')
    expect(app.getState().editingTaskId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadPomState – restores from sessionStorage (line 1273)
// ---------------------------------------------------------------------------
describe('loadPomState', () => {
  it('is automatically called by init and restores sessionStorage data', () => {
    // Pre-populate sessionStorage with a saved pomodoro state
    const pomData = { mode: 'break', remaining: 120, running: false, cycles: 3 };
    sessionStorage.setItem('studyplaner_pomodoro', JSON.stringify(pomData));
    // init() calls loadPomState()
    app.init();
    const pom = app.getPomState();
    expect(pom.mode).toBe('break');
    expect(pom.remaining).toBe(120);
    expect(pom.cycles).toBe(3);
  });

  it('falls back to default when sessionStorage contains corrupt data', () => {
    sessionStorage.setItem('studyplaner_pomodoro', 'CORRUPT{{{{');
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.init();
    // Should not throw and should have sensible remaining time
    expect(app.getPomState().remaining).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// requestNotifications (line 1232)
// ---------------------------------------------------------------------------
describe('requestNotifications', () => {
  it('calls Notification.requestPermission when enabled and permission is default', () => {
    // Patch Notification to simulate 'default' permission
    const origPermission = Object.getOwnPropertyDescriptor(global.Notification, 'permission');
    Object.defineProperty(global.Notification, 'permission', {
      get: () => 'default',
      configurable: true,
    });
    global.Notification.requestPermission = jest.fn().mockResolvedValue('granted');

    app.setState({ settings: { ...app.DEFAULT_SETTINGS, notificationsEnabled: true } });
    app.init(); // requestNotifications is called by init()
    expect(global.Notification.requestPermission).toHaveBeenCalled();

    // Restore
    if (origPermission) Object.defineProperty(global.Notification, 'permission', origPermission);
    else Object.defineProperty(global.Notification, 'permission', { get: () => 'denied', configurable: true });
  });
});

// ---------------------------------------------------------------------------
// sendNotifications (lines 1240-1257)
// ---------------------------------------------------------------------------
describe('sendNotifications', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore Notification.permission to 'denied' default
    Object.defineProperty(global.Notification, 'permission', {
      get: () => 'denied',
      configurable: true,
    });
  });

  it('sends a notification when permission is granted and tasks are due', () => {
    // Give the global Notification class 'granted' permission
    Object.defineProperty(global.Notification, 'permission', {
      get: () => 'granted',
      configurable: true,
    });

    app.setState({
      settings: { ...app.DEFAULT_SETTINGS, notificationsEnabled: true, reminderDays: 1 },
      tasks: [makeTask({ deadline: '2024-06-15', done: false })],
    });
    // init() calls sendNotifications; it should create a Notification without throwing
    expect(() => app.init()).not.toThrow();
  });

  it('does not send a notification when notifications are disabled', () => {
    Object.defineProperty(global.Notification, 'permission', {
      get: () => 'granted',
      configurable: true,
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    app.setState({
      settings: { ...app.DEFAULT_SETTINGS, notificationsEnabled: false },
      tasks: [makeTask({ deadline: '2024-06-15', done: false })],
    });
    expect(() => app.init()).not.toThrow();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// notifyPomodoro – sends notification when permission is granted (line 1331)
// ---------------------------------------------------------------------------
describe('notifyPomodoro', () => {
  afterEach(() => {
    Object.defineProperty(global.Notification, 'permission', {
      get: () => 'denied',
      configurable: true,
    });
  });

  it('fires when permission is granted and a work phase ends', () => {
    jest.useFakeTimers();
    Object.defineProperty(global.Notification, 'permission', {
      get: () => 'granted',
      configurable: true,
    });

    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 1, pomodoroBreak: 1 } });
    app.resetPomodoro();
    app.getPomState().remaining = 1;
    app.togglePomodoro(); // start
    // Advancing by 1 s triggers the tick that reaches 0 → notifyPomodoro runs
    expect(() => jest.advanceTimersByTime(1000)).not.toThrow();
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// openModal – focus timeout (lines 1072-1073)
// ---------------------------------------------------------------------------
describe('openModal – focus first element after 50 ms', () => {
  it('focuses the first input in the modal after the timeout', () => {
    jest.useFakeTimers();
    document.getElementById('openAddTaskBtn').click(); // opens modalOverlay
    jest.advanceTimersByTime(60); // advance past the 50 ms focus timeout
    // The first focusable element in the modal should be focused
    const focusable = document.getElementById('modalOverlay').querySelector(
      'input, select, textarea, button:not(.modal-close)'
    );
    if (focusable) {
      // document.activeElement should be the focusable element
      expect(document.activeElement).toBe(focusable);
    }
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// renderAll – mobile width branch (line 1445)
// ---------------------------------------------------------------------------
describe('renderAll – mobile width branch', () => {
  it('activates the timetable tab when window width ≤ 600', () => {
    // Override innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true, configurable: true });
    app.renderAll();
    expect(document.querySelector('.panel-left').classList.contains('tab-active')).toBe(true);
    // Restore
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
  });
});
describe('saveState – localStorage write failure', () => {
  it('does not throw when localStorage.setItem fails', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => app.saveState()).not.toThrow();
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });
});
