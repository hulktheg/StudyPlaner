'use strict';

/**
 * Event-handler integration tests.
 * They fire real DOM events on elements whose listeners were registered
 * at module-load time (or by renderTaskList/renderSubjectLegend) and
 * verify the resulting state or DOM change.
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
// Theme toggle
// ---------------------------------------------------------------------------
describe('theme toggle button', () => {
  it('switches from light to dark on click', () => {
    app.setState({ theme: 'light' });
    document.getElementById('themeToggle').click();
    expect(app.getState().theme).toBe('dark');
    expect(document.body.dataset.theme).toBe('dark');
  });

  it('switches from dark back to light on a second click', () => {
    app.setState({ theme: 'dark' });
    document.getElementById('themeToggle').click();
    expect(app.getState().theme).toBe('light');
  });

  it('persists the new theme to localStorage', () => {
    app.setState({ theme: 'light' });
    document.getElementById('themeToggle').click();
    const saved = JSON.parse(localStorage.getItem('studyplaner_v3'));
    expect(saved.theme).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// Mobile tab navigation
// ---------------------------------------------------------------------------
describe('mobile tabs', () => {
  beforeEach(() => {
    // initMobileTabs is called by renderAll
    app.renderAll();
  });

  it('activates the homework tab on click', () => {
    document.querySelector('.mobile-tab[data-tab="homework"]').click();
    expect(document.querySelector('.mobile-tab[data-tab="homework"]').classList.contains('active')).toBe(true);
  });

  it('activates the deadlines tab on click', () => {
    document.querySelector('.mobile-tab[data-tab="deadlines"]').click();
    expect(document.querySelector('.mobile-tab[data-tab="deadlines"]').classList.contains('active')).toBe(true);
  });

  it('adds tab-active class to the corresponding panel', () => {
    document.querySelector('.mobile-tab[data-tab="homework"]').click();
    expect(document.getElementById('tabHomework').classList.contains('tab-active')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter buttons
// ---------------------------------------------------------------------------
describe('filter buttons', () => {
  it('updates state.filter when a filter button is clicked', () => {
    document.querySelector('.filter-btn[data-filter="open"]').click();
    expect(app.getState().filter).toBe('open');
  });

  it('marks only the clicked button as active', () => {
    document.querySelector('.filter-btn[data-filter="done"]').click();
    const activeButtons = document.querySelectorAll('.filter-btn.active');
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].dataset.filter).toBe('done');
  });

  it('re-renders the task list on filter change', () => {
    app.setState({
      tasks: [makeTask({ done: false }), makeTask({ done: true })],
      subjects: [],
      search: '',
      filter: 'all',
    });
    app.renderTaskList(); // set up initial list
    document.querySelector('.filter-btn[data-filter="open"]').click();
    expect(document.querySelectorAll('.task-item').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task search
// ---------------------------------------------------------------------------
describe('task search input', () => {
  it('updates state.search on input', () => {
    const input = document.getElementById('taskSearch');
    input.value = 'biology';
    input.dispatchEvent(new Event('input'));
    expect(app.getState().search).toBe('biology');
  });

  it('filters the task list based on search text', () => {
    app.setState({
      tasks: [makeTask({ id: '1', desc: 'Biology homework' }), makeTask({ id: '2', desc: 'Math worksheet' })],
      subjects: [],
      filter: 'all',
    });
    app.renderTaskList();
    const input = document.getElementById('taskSearch');
    input.value = 'biology';
    input.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.task-item').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Add subject button
// ---------------------------------------------------------------------------
describe('addSubjectBtn', () => {
  it('adds a new subject when a name is provided', () => {
    app.setState({ subjects: [], selectedColor: app.SUBJECT_COLORS[0] });
    document.getElementById('newSubjectName').value = 'Chemistry';
    document.getElementById('addSubjectBtn').click();
    expect(app.getState().subjects).toHaveLength(1);
    expect(app.getState().subjects[0].name).toBe('Chemistry');
  });

  it('adds a subject with the optional grade', () => {
    app.setState({ subjects: [], selectedColor: app.SUBJECT_COLORS[0] });
    document.getElementById('newSubjectName').value = 'Physics';
    document.getElementById('newSubjectGrade').value = '2';
    document.getElementById('addSubjectBtn').click();
    expect(app.getState().subjects[0].grade).toBe('2');
  });

  it('does not add a subject when name is empty', () => {
    app.setState({ subjects: [] });
    document.getElementById('newSubjectName').value = '';
    document.getElementById('addSubjectBtn').click();
    expect(app.getState().subjects).toHaveLength(0);
  });

  it('alerts on duplicate subject name and does not add a second entry', () => {
    app.setState({ subjects: [{ id: '1', name: 'Math', color: '#667eea', grade: '' }] });
    document.getElementById('newSubjectName').value = 'Math';
    document.getElementById('addSubjectBtn').click();
    expect(global.alert).toHaveBeenCalled();
    expect(app.getState().subjects).toHaveLength(1);
  });

  it('advances the selected colour to the next swatch', () => {
    app.setState({ subjects: [], selectedColor: app.SUBJECT_COLORS[0] });
    document.getElementById('newSubjectName').value = 'Art';
    document.getElementById('addSubjectBtn').click();
    expect(app.getState().selectedColor).toBe(app.SUBJECT_COLORS[1]);
  });

  it('adds a subject when Enter is pressed in the name field', () => {
    app.setState({ subjects: [], selectedColor: app.SUBJECT_COLORS[0] });
    const nameInput = document.getElementById('newSubjectName');
    nameInput.value = 'History';
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.getState().subjects).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Remove subject button (rendered by renderSubjectLegend)
// ---------------------------------------------------------------------------
describe('remove subject button', () => {
  beforeEach(() => {
    app.setState({
      subjects: [{ id: 's1', name: 'Art', color: '#ed64a6', grade: '' }],
      tasks: [],
      timetable: {},
      timetableB: {},
    });
    // renderAll also calls renderSubjectLegend, which creates the remove buttons
    app.renderAll();
  });

  it('removes the subject when confirmed', () => {
    global.confirm.mockReturnValue(true);
    document.querySelector('.subject-tag-remove').click();
    expect(app.getState().subjects).toHaveLength(0);
  });

  it('keeps the subject when confirm is cancelled', () => {
    global.confirm.mockReturnValue(false);
    document.querySelector('.subject-tag-remove').click();
    expect(app.getState().subjects).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Task checkbox (toggleTaskDone) via rendered task list
// ---------------------------------------------------------------------------
describe('task checkbox', () => {
  beforeEach(() => {
    app.setState({
      tasks: [makeTask({ id: 't1', done: false })],
      subjects: [],
      filter: 'all',
      search: '',
    });
    app.renderTaskList();
  });

  it('marks the task as done when checked', () => {
    const checkbox = document.querySelector('.task-checkbox');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.getState().tasks[0].done).toBe(true);
  });

  it('records doneAt timestamp when task is completed', () => {
    const checkbox = document.querySelector('.task-checkbox');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.getState().tasks[0].doneAt).not.toBeNull();
  });

  it('clears doneAt when task is un-checked', () => {
    // First mark done
    const task = app.getState().tasks[0];
    task.done = true;
    task.doneAt = new Date().toISOString();
    app.renderTaskList();
    const checkbox = document.querySelector('.task-checkbox');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.getState().tasks[0].doneAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task delete button (_removeTask) via rendered task list
// ---------------------------------------------------------------------------
describe('task delete button', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    app.setState({
      tasks: [makeTask({ id: 'del1', desc: 'To be deleted' })],
      subjects: [],
      filter: 'all',
      search: '',
    });
    app.renderTaskList();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('removes the task from state after the animation timeout', () => {
    document.querySelector('.btn-danger').click();
    // The deletion is deferred by 280 ms (animation)
    jest.advanceTimersByTime(300);
    expect(app.getState().tasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Snooze task button via rendered task list
// ---------------------------------------------------------------------------
describe('snooze task button', () => {
  it('advances the deadline by 1 day', () => {
    app.setState({
      tasks: [makeTask({ id: 's1', deadline: '2024-06-15', done: false })],
      subjects: [],
      filter: 'all',
      search: '',
    });
    app.renderTaskList();
    document.querySelector('.btn-snooze').click();
    expect(app.getState().tasks[0].deadline).toBe('2024-06-16');
  });
});

// ---------------------------------------------------------------------------
// Clear completed tasks button
// ---------------------------------------------------------------------------
describe('clearDoneBtn', () => {
  it('alerts when there are no done tasks', () => {
    app.setState({ tasks: [makeTask({ done: false })], subjects: [], filter: 'all', search: '' });
    document.getElementById('clearDoneBtn').click();
    expect(global.alert).toHaveBeenCalled();
    expect(app.getState().tasks).toHaveLength(1);
  });

  it('removes done tasks when user confirms', () => {
    global.confirm.mockReturnValue(true);
    app.setState({
      tasks: [makeTask({ done: true }), makeTask({ done: false })],
      subjects: [], filter: 'all', search: '',
    });
    document.getElementById('clearDoneBtn').click();
    expect(app.getState().tasks).toHaveLength(1);
    expect(app.getState().tasks[0].done).toBe(false);
  });

  it('keeps all tasks when user cancels the confirmation', () => {
    global.confirm.mockReturnValue(false);
    app.setState({
      tasks: [makeTask({ done: true }), makeTask({ done: false })],
      subjects: [], filter: 'all', search: '',
    });
    document.getElementById('clearDoneBtn').click();
    expect(app.getState().tasks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Task modal (add / edit / submit)
// ---------------------------------------------------------------------------
describe('task modal', () => {
  it('opens the add-task modal on button click', () => {
    document.getElementById('openAddTaskBtn').click();
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(true);
  });

  it('closes the modal when cancel button is clicked', () => {
    document.getElementById('openAddTaskBtn').click();
    document.getElementById('cancelTaskBtn').click();
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(false);
  });

  it('closes the modal when the × button is clicked', () => {
    document.getElementById('openAddTaskBtn').click();
    document.getElementById('closeModalBtn').click();
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(false);
  });

  it('shows a validation error when desc is empty and form is submitted', () => {
    document.getElementById('openAddTaskBtn').click();
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(document.getElementById('taskDescError').hidden).toBe(false);
  });

  it('adds a new task when the form is submitted with a description', () => {
    app.setState({ tasks: [], subjects: [], filter: 'all', search: '' });
    document.getElementById('openAddTaskBtn').click();
    document.getElementById('taskDesc').value = 'New test task';
    document.querySelector('input[name="priority"][value="high"]').checked = true;
    document.getElementById('taskForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(app.getState().tasks).toHaveLength(1);
    expect(app.getState().tasks[0].desc).toBe('New test task');
    expect(app.getState().tasks[0].priority).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Modal close on overlay click
// ---------------------------------------------------------------------------
describe('modal overlay click to close', () => {
  it('closes the task modal when clicking on the overlay background', () => {
    document.getElementById('openAddTaskBtn').click();
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(true);
    document.getElementById('modalOverlay').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // The overlay click only closes if target === overlay itself
    // (clicking inside the modal doesn't close it)
    // Simulate clicking exactly on the overlay element
    const event = new MouseEvent('click', { bubbles: false });
    Object.defineProperty(event, 'target', { value: document.getElementById('modalOverlay') });
    document.getElementById('modalOverlay').dispatchEvent(event);
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------
describe('settings modal', () => {
  it('opens the settings modal on button click', () => {
    document.getElementById('settingsBtn').click();
    expect(document.getElementById('settingsModalOverlay').classList.contains('active')).toBe(true);
  });

  it('closes the settings modal on cancel', () => {
    document.getElementById('settingsBtn').click();
    document.getElementById('cancelSettingsBtn').click();
    expect(document.getElementById('settingsModalOverlay').classList.contains('active')).toBe(false);
  });

  it('saves updated settings on save button click', () => {
    document.getElementById('settingsBtn').click();
    document.getElementById('settingPeriods').value = '6';
    document.getElementById('settingStartHour').value = '9';
    document.getElementById('settingPeriodDuration').value = '50';
    document.getElementById('settingSaturday').checked = true;
    document.getElementById('settingABWeek').checked = false;
    document.getElementById('settingNotifications').checked = false;
    document.getElementById('settingReminderDays').value = '2';
    document.getElementById('settingPomodoroWork').value = '30';
    document.getElementById('settingPomodoroBreak').value = '10';
    document.getElementById('saveSettingsBtn').click();
    const s = app.getState().settings;
    expect(s.periods).toBe(6);
    expect(s.startHour).toBe(9);
    expect(s.periodDuration).toBe(50);
    expect(s.showSaturday).toBe(true);
    expect(s.reminderDays).toBe(2);
    expect(s.pomodoroWork).toBe(30);
    expect(s.pomodoroBreak).toBe(10);
  });

  it('clamps settings values to allowed ranges', () => {
    document.getElementById('settingsBtn').click();
    document.getElementById('settingPeriods').value = '99'; // max 10
    document.getElementById('settingStartHour').value = '3'; // min 6
    document.getElementById('saveSettingsBtn').click();
    const s = app.getState().settings;
    expect(s.periods).toBe(10);
    expect(s.startHour).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// A/B week buttons
// ---------------------------------------------------------------------------
describe('A/B week buttons', () => {
  it('switches to week A on button click', () => {
    app.setState({ currentWeek: 'B', settings: { ...app.DEFAULT_SETTINGS, abWeek: true }, subjects: [], timetable: {}, timetableB: {} });
    document.getElementById('weekABtn').click();
    expect(app.getState().currentWeek).toBe('A');
  });

  it('switches to week B on button click', () => {
    app.setState({ currentWeek: 'A', settings: { ...app.DEFAULT_SETTINGS, abWeek: true }, subjects: [], timetable: {}, timetableB: {} });
    document.getElementById('weekBBtn').click();
    expect(app.getState().currentWeek).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Clear timetable button
// ---------------------------------------------------------------------------
describe('clearTimetableBtn', () => {
  it('clears the current week timetable when confirmed', () => {
    global.confirm.mockReturnValue(true);
    app.setState({
      timetable: { '0-0': 's1', '1-1': 's1' },
      timetableB: {},
      currentWeek: 'A',
      subjects: [],
      settings: { ...app.DEFAULT_SETTINGS },
    });
    document.getElementById('clearTimetableBtn').click();
    expect(app.getState().timetable).toEqual({});
  });

  it('keeps the timetable when confirm is cancelled', () => {
    global.confirm.mockReturnValue(false);
    app.setState({
      timetable: { '0-0': 's1' },
      timetableB: {},
      currentWeek: 'A',
      subjects: [],
      settings: { ...app.DEFAULT_SETTINGS },
    });
    document.getElementById('clearTimetableBtn').click();
    expect(app.getState().timetable).toEqual({ '0-0': 's1' });
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts panel
// ---------------------------------------------------------------------------
describe('keyboard shortcuts panel', () => {
  it('shows the shortcuts panel when the ⌨️ button is clicked', () => {
    document.getElementById('shortcutsBtn').click();
    expect(document.getElementById('shortcutsPanel').hidden).toBe(false);
  });

  it('hides the shortcuts panel when the close button is clicked', () => {
    document.getElementById('shortcutsBtn').click(); // open
    document.getElementById('closeShortcutsBtn').click(); // close
    expect(document.getElementById('shortcutsPanel').hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts (keydown on document)
// ---------------------------------------------------------------------------
describe('keyboard shortcuts (keydown)', () => {
  it('opens the add-task modal when "n" is pressed', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(true);
  });

  it('opens the settings modal when "s" is pressed', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
    expect(document.getElementById('settingsModalOverlay').classList.contains('active')).toBe(true);
  });

  it('closes open modals when Escape is pressed', () => {
    document.getElementById('openAddTaskBtn').click(); // open modal
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(false);
  });

  it('ignores shortcut keys when an input element is focused', () => {
    const input = document.getElementById('taskSearch');
    input.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    // taskSearch is focused; the shortcut should be ignored
    expect(document.getElementById('modalOverlay').classList.contains('active')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Export modal
// ---------------------------------------------------------------------------
describe('export modal', () => {
  it('opens the export modal when the 💾 button is clicked', () => {
    document.getElementById('exportBtn').click();
    expect(document.getElementById('exportModalOverlay').classList.contains('active')).toBe(true);
  });

  it('closes the export modal when the × button is clicked', () => {
    document.getElementById('exportBtn').click();
    document.getElementById('closeExportModalBtn').click();
    expect(document.getElementById('exportModalOverlay').classList.contains('active')).toBe(false);
  });

  it('creates a JSON blob and triggers a download on exportJsonBtn click', () => {
    app.setState({ tasks: [], subjects: [], timetable: {}, timetableB: {}, theme: 'light', settings: { ...app.DEFAULT_SETTINGS } });
    document.getElementById('exportBtn').click();
    document.getElementById('exportJsonBtn').click();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('creates a CSV blob and triggers a download on exportCsvBtn click', () => {
    app.setState({ tasks: [makeTask({ desc: 'CSV task' })], subjects: [], timetable: {}, timetableB: {} });
    document.getElementById('exportBtn').click();
    document.getElementById('exportCsvBtn').click();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pomodoro widget UI
// ---------------------------------------------------------------------------
describe('pomodoro widget buttons', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25, pomodoroBreak: 5 } });
    app.resetPomodoro();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts the timer when start button is clicked', () => {
    document.getElementById('pomodoroStartBtn').click();
    expect(app.getPomState().running).toBe(true);
  });

  it('resets the timer when reset button is clicked', () => {
    document.getElementById('pomodoroStartBtn').click(); // start
    jest.advanceTimersByTime(5000);                      // run 5 s
    document.getElementById('pomodoroResetBtn').click(); // reset
    expect(app.getPomState().remaining).toBe(25 * 60);
    expect(app.getPomState().running).toBe(false);
  });

  it('skips to the next phase when skip button is clicked', () => {
    // In work mode → skip → break mode
    document.getElementById('pomodoroSkipBtn').click();
    expect(app.getPomState().mode).toBe('break');
    expect(app.getPomState().cycles).toBe(1); // work phase counted
  });

  it('collapses the pomodoro body when the − button is clicked', () => {
    const body = document.getElementById('pomodoroBody');
    body.hidden = false;
    document.getElementById('pomodoroToggle').click();
    expect(body.hidden).toBe(true);
  });

  it('expands the pomodoro body on a second click', () => {
    const body = document.getElementById('pomodoroBody');
    body.hidden = false;
    document.getElementById('pomodoroToggle').click(); // collapse
    document.getElementById('pomodoroToggle').click(); // expand
    expect(body.hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleStats / renderStats via toggle button
// ---------------------------------------------------------------------------
describe('toggleStats button', () => {
  it('makes the stats body visible on click', () => {
    document.getElementById('toggleStats').click();
    expect(document.getElementById('statsBody').hidden).toBe(false);
  });

  it('hides the stats body on a second click', () => {
    document.getElementById('toggleStats').click(); // show
    document.getElementById('toggleStats').click(); // hide
    expect(document.getElementById('statsBody').hidden).toBe(true);
  });

  it('renders stats content when shown', () => {
    app.setState({
      tasks: [
        { id: '1', desc: 'Done', done: true, doneAt: new Date().toISOString(), deadline: '', priority: 'low', notes: '', subjectId: '', createdAt: '' },
      ],
      subjects: [],
    });
    document.getElementById('toggleStats').click();
    // statsSubjectList should be present (even if showing "Keine offenen Aufgaben")
    expect(document.getElementById('statsSubjectList')).not.toBeNull();
  });
});
