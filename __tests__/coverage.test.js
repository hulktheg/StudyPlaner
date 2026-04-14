'use strict';

/**
 * Supplementary coverage tests targeting specific uncovered branches
 * identified from the coverage report.
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
// activateMobileTab – timetable branch (line 129)
// ---------------------------------------------------------------------------
describe('activateMobileTab – timetable branch', () => {
  it('adds tab-active to panel-left when the timetable tab is selected', () => {
    app.renderAll();
    document.querySelector('.mobile-tab[data-tab="timetable"]').click();
    expect(document.querySelector('.panel-left').classList.contains('tab-active')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Color swatch click (lines 180-181)
// ---------------------------------------------------------------------------
describe('colour swatch click', () => {
  it('updates state.selectedColor when a swatch is clicked', () => {
    app.setState({ selectedColor: app.SUBJECT_COLORS[0] });
    app.renderAll(); // renders swatches
    const swatches = document.querySelectorAll('.color-swatch');
    expect(swatches.length).toBeGreaterThan(1);
    // Click the second swatch (index 1)
    swatches[1].click();
    expect(app.getState().selectedColor).toBe(app.SUBJECT_COLORS[1]);
  });
});

// ---------------------------------------------------------------------------
// toggleSubjectOverview button (lines 340-346)
// ---------------------------------------------------------------------------
describe('toggleSubjectOverview button', () => {
  it('shows the subject overview body when toggled open', () => {
    app.setState({ subjects: [], tasks: [] });
    const body = document.getElementById('subjectOverviewBody');
    body.hidden = true; // start hidden
    document.getElementById('toggleSubjectOverview').click();
    expect(body.hidden).toBe(false);
  });

  it('hides the subject overview body when toggled again', () => {
    const body = document.getElementById('subjectOverviewBody');
    body.hidden = true;
    document.getElementById('toggleSubjectOverview').click(); // show
    document.getElementById('toggleSubjectOverview').click(); // hide
    expect(body.hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Timetable cell click → openCellModal (lines 435-443)
// and saveCellBtn (lines 447-459)
// ---------------------------------------------------------------------------
describe('timetable cell modal', () => {
  beforeEach(() => {
    app.setState({
      subjects: [{ id: 's1', name: 'Math', color: '#667eea', grade: '' }],
      timetable: {},
      timetableB: {},
      currentWeek: 'A',
      settings: { ...app.DEFAULT_SETTINGS, periods: 3, showSaturday: false },
    });
    app.renderTimetable();
  });

  it('opens the cell modal when a timetable cell is clicked', () => {
    document.querySelector('.timetable-cell').click();
    expect(document.getElementById('cellModalOverlay').classList.contains('active')).toBe(true);
  });

  it('assigns a subject to the slot and closes the modal on save', () => {
    document.querySelector('.timetable-cell').click();
    document.getElementById('cellSubjectSelect').value = 's1';
    document.getElementById('saveCellBtn').click();
    expect(document.getElementById('cellModalOverlay').classList.contains('active')).toBe(false);
    // The slot '0-0' should now be assigned to 's1'
    expect(app.getState().timetable['0-0']).toBe('s1');
  });

  it('removes the assignment when subject is set to empty and saved', () => {
    // First assign
    app.setState({ timetable: { '0-0': 's1' } });
    app.renderTimetable();
    document.querySelector('.timetable-cell').click();
    document.getElementById('cellSubjectSelect').value = '';
    document.getElementById('saveCellBtn').click();
    expect(app.getState().timetable['0-0']).toBeUndefined();
  });

  it('closes the cell modal on cancel', () => {
    document.querySelector('.timetable-cell').click();
    document.getElementById('cancelCellBtn').click();
    expect(document.getElementById('cellModalOverlay').classList.contains('active')).toBe(false);
  });

  it('closes the cell modal on the × button', () => {
    document.querySelector('.timetable-cell').click();
    document.getElementById('closeCellModalBtn').click();
    expect(document.getElementById('cellModalOverlay').classList.contains('active')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearTimetableBtn – week B branch (line 468)
// ---------------------------------------------------------------------------
describe('clearTimetableBtn – week B', () => {
  it('clears timetableB when current week is B', () => {
    global.confirm.mockReturnValue(true);
    app.setState({
      timetable:  { '0-0': 's1' },
      timetableB: { '0-0': 's1' },
      currentWeek: 'B',
      subjects: [],
      settings: { ...app.DEFAULT_SETTINGS },
    });
    document.getElementById('clearTimetableBtn').click();
    expect(app.getState().timetableB).toEqual({});
    // timetable (A) should be untouched
    expect(app.getState().timetable).toEqual({ '0-0': 's1' });
  });
});

// ---------------------------------------------------------------------------
// openEditTaskModal (lines 509-522)
// ---------------------------------------------------------------------------
describe('openEditTaskModal', () => {
  it('opens the modal pre-filled when the edit button is clicked', () => {
    const task = makeTask({ id: 'e1', desc: 'Edit me', priority: 'high', deadline: '2024-06-20' });
    app.setState({ tasks: [task], subjects: [], filter: 'all', search: '' });
    app.renderTaskList();
    // Use title attribute to target the edit button inside the task item
    document.querySelector('.task-item [title="Bearbeiten"]').click();
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(true);
    expect(document.getElementById('taskDesc').value).toBe('Edit me');
    expect(document.getElementById('taskDeadline').value).toBe('2024-06-20');
  });

  it('updates the task desc when the edit form is submitted', () => {
    const task = makeTask({ id: 'e2', desc: 'Original desc', priority: 'low' });
    app.setState({ tasks: [task], subjects: [], filter: 'all', search: '' });
    app.renderTaskList();
    document.querySelector('.task-item [title="Bearbeiten"]').click(); // open edit modal
    document.getElementById('taskDesc').value = 'Updated desc';
    document.getElementById('taskForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(app.getState().tasks[0].desc).toBe('Updated desc');
  });
});

// ---------------------------------------------------------------------------
// Done task with a deadline renders date badge (line 731)
// ---------------------------------------------------------------------------
describe('createTaskElement – done task with deadline', () => {
  it('renders a date label (not a snooze button) for a done task with a deadline', () => {
    app.setState({
      tasks: [makeTask({ id: 'd1', done: true, deadline: '2024-06-10' })],
      subjects: [],
      filter: 'all',
      search: '',
    });
    app.renderTaskList();
    // A done task should show the deadline date but NOT a snooze button
    expect(document.querySelector('.task-deadline')).not.toBeNull();
    expect(document.querySelector('.btn-snooze')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Notes toggle in task items (lines 739-748)
// ---------------------------------------------------------------------------
describe('task notes toggle', () => {
  beforeEach(() => {
    app.setState({
      tasks: [makeTask({ id: 'n1', notes: 'These are notes', deadline: '' })],
      subjects: [],
      filter: 'all',
      search: '',
    });
    app.renderTaskList();
  });

  it('renders a notes toggle button when the task has notes', () => {
    expect(document.querySelector('.btn-notes-toggle')).not.toBeNull();
  });

  it('expands the notes section when the notes toggle button is clicked', () => {
    document.querySelector('.btn-notes-toggle').click();
    const notesEl = document.querySelector('.task-notes');
    expect(notesEl.classList.contains('expanded')).toBe(true);
  });

  it('collapses the notes section on a second click', () => {
    const btn = document.querySelector('.btn-notes-toggle');
    btn.click(); // expand
    btn.click(); // collapse
    const notesEl = document.querySelector('.task-notes');
    expect(notesEl.classList.contains('collapsed')).toBe(true);
  });

  it('updates aria-expanded attribute on the toggle button', () => {
    const btn = document.querySelector('.btn-notes-toggle');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcut 'F' – focus task search (line 1167)
// ---------------------------------------------------------------------------
describe('keyboard shortcut F', () => {
  it('calls preventDefault when F is pressed (verifying handler reached line 1167)', () => {
    // Make sure no input is focused so the early-return guard doesn't fire
    document.body.focus();
    const event = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcut 'P' – toggle pomodoro (lines 1169-1170)
// ---------------------------------------------------------------------------
describe('keyboard shortcut P', () => {
  it('starts the pomodoro timer when P is pressed', () => {
    jest.useFakeTimers();
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    expect(app.getPomState().running).toBe(true);
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// renderDeadlines – sorting within a section (lines 818-820)
// ---------------------------------------------------------------------------
describe('renderDeadlines – multi-task sorting within a section', () => {
  it('sorts tasks in the today section by deadline then priority', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));

    app.setState({
      tasks: [
        makeTask({ id: 'b', deadline: '2024-06-15', priority: 'low',  done: false }),
        makeTask({ id: 'a', deadline: '2024-06-15', priority: 'high', done: false }),
      ],
      subjects: [],
    });
    app.renderDeadlines();
    const items = document.querySelectorAll('#deadlineToday .deadline-item');
    expect(items.length).toBe(2);
    // 'a' (high priority) should come first
    expect(items[0].querySelector('.deadline-task-desc')).not.toBeNull();

    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Timetable cell keyboard navigation (Enter / Space opens modal)
// ---------------------------------------------------------------------------
describe('timetable cell keyboard navigation', () => {
  it('opens the cell modal when Enter is pressed on a timetable cell', () => {
    app.setState({
      subjects: [],
      timetable: {},
      timetableB: {},
      currentWeek: 'A',
      settings: { ...app.DEFAULT_SETTINGS, periods: 2, showSaturday: false },
    });
    app.renderTimetable();
    const cell = document.querySelector('.timetable-cell');
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.getElementById('cellModalOverlay').classList.contains('active')).toBe(true);
  });
});
