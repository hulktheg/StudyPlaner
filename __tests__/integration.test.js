'use strict';

/**
 * Integration tests that exercise DOM-rendering functions.
 * Each test loads a fresh copy of app.js (via jest.resetModules in
 * jest.setup.js beforeEach) into the jsdom environment rebuilt from
 * index.html's body content.
 */

let app;

function makeTask(overrides = {}) {
  return {
    id:        overrides.id        ?? String(Date.now() + Math.random()),
    desc:      overrides.desc      ?? 'Test task',
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
// updateProgress
// ---------------------------------------------------------------------------
describe('updateProgress', () => {
  it('shows 0 of 0 when there are no tasks', () => {
    app.setState({ tasks: [] });
    app.updateProgress();
    expect(document.getElementById('progressText').textContent).toBe('0 von 0 erledigt');
  });

  it('reflects a partially-completed task list', () => {
    app.setState({
      tasks: [
        makeTask({ done: true }),
        makeTask({ done: false }),
        makeTask({ done: false }),
      ],
    });
    app.updateProgress();
    expect(document.getElementById('progressText').textContent).toBe('1 von 3 erledigt');
  });

  it('sets the progress bar fill width to the correct percentage', () => {
    app.setState({
      tasks: [makeTask({ done: true }), makeTask({ done: true }), makeTask({ done: false })],
    });
    app.updateProgress();
    const fill = document.getElementById('progressBarFill');
    expect(fill.style.width).toBe('67%'); // Math.round(2/3 * 100) = 67
  });

  it('sets fill width to 100% when all tasks are done', () => {
    app.setState({ tasks: [makeTask({ done: true }), makeTask({ done: true })] });
    app.updateProgress();
    expect(document.getElementById('progressBarFill').style.width).toBe('100%');
  });

  it('sets fill width to 0% when no tasks are done', () => {
    app.setState({ tasks: [makeTask({ done: false })] });
    app.updateProgress();
    expect(document.getElementById('progressBarFill').style.width).toBe('0%');
  });
});

// ---------------------------------------------------------------------------
// updateOverdueBadge
// ---------------------------------------------------------------------------
describe('updateOverdueBadge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides the badge when there are no overdue tasks', () => {
    app.setState({ tasks: [] });
    app.updateOverdueBadge();
    expect(document.getElementById('overdueBadge').hidden).toBe(true);
  });

  it('shows the badge with the correct count of overdue tasks', () => {
    app.setState({
      tasks: [
        makeTask({ done: false, deadline: '2024-06-10' }), // overdue
        makeTask({ done: false, deadline: '2024-06-11' }), // overdue
        makeTask({ done: false, deadline: '2024-06-20' }), // future – not overdue
        makeTask({ done: true,  deadline: '2024-06-01' }), // done – not counted
      ],
    });
    app.updateOverdueBadge();
    const badge = document.getElementById('overdueBadge');
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('2');
  });

  it('hides the badge when all overdue tasks are marked done', () => {
    app.setState({
      tasks: [makeTask({ done: true, deadline: '2024-06-01' })],
    });
    app.updateOverdueBadge();
    expect(document.getElementById('overdueBadge').hidden).toBe(true);
  });

  it('hides the badge when overdue tasks have no deadline', () => {
    // A task without a deadline should never be "overdue"
    app.setState({ tasks: [makeTask({ done: false, deadline: '' })] });
    app.updateOverdueBadge();
    expect(document.getElementById('overdueBadge').hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderDeadlines – section categorisation
// ---------------------------------------------------------------------------
describe('renderDeadlines – section categorisation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z')); // Saturday 15 June 2024
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('places an overdue task in the today/overdue section', () => {
    app.setState({ tasks: [makeTask({ id: 'ov', deadline: '2024-06-10', done: false })], subjects: [] });
    app.renderDeadlines();
    const section = document.getElementById('deadlineToday');
    expect(section.querySelectorAll('.deadline-item').length).toBe(1);
  });

  it('places a today task in the today/overdue section', () => {
    app.setState({ tasks: [makeTask({ id: 'td', deadline: '2024-06-15', done: false })], subjects: [] });
    app.renderDeadlines();
    const section = document.getElementById('deadlineToday');
    expect(section.querySelectorAll('.deadline-item').length).toBe(1);
  });

  it('places a tomorrow task in the tomorrow section', () => {
    app.setState({ tasks: [makeTask({ id: 'tm', deadline: '2024-06-16', done: false })], subjects: [] });
    app.renderDeadlines();
    expect(document.getElementById('deadlineTomorrow').querySelectorAll('.deadline-item').length).toBe(1);
  });

  it('places a task within 2-6 days in the this-week section', () => {
    app.setState({ tasks: [makeTask({ id: 'wk', deadline: '2024-06-18', done: false })], subjects: [] });
    app.renderDeadlines();
    expect(document.getElementById('deadlineWeek').querySelectorAll('.deadline-item').length).toBe(1);
  });

  it('places a task 7–13 days away in the two-weeks section', () => {
    app.setState({ tasks: [makeTask({ id: 'tw', deadline: '2024-06-22', done: false })], subjects: [] });
    app.renderDeadlines();
    expect(document.getElementById('deadlineTwoWeeks').querySelectorAll('.deadline-item').length).toBe(1);
  });

  it('places a task 14+ days away in the later section', () => {
    app.setState({ tasks: [makeTask({ id: 'lt', deadline: '2024-07-10', done: false })], subjects: [] });
    app.renderDeadlines();
    expect(document.getElementById('deadlineLater').querySelectorAll('.deadline-item').length).toBe(1);
  });

  it('does not show done tasks in any deadline section', () => {
    app.setState({ tasks: [makeTask({ id: 'dn', deadline: '2024-06-10', done: true })], subjects: [] });
    app.renderDeadlines();
    const allItems = document.querySelectorAll('.deadline-item');
    expect(allItems.length).toBe(0);
  });

  it('does not show tasks without a deadline', () => {
    app.setState({ tasks: [makeTask({ id: 'nd', deadline: '', done: false })], subjects: [] });
    app.renderDeadlines();
    const allItems = document.querySelectorAll('.deadline-item');
    expect(allItems.length).toBe(0);
  });

  it('shows the empty-state message when a section has no tasks', () => {
    app.setState({ tasks: [], subjects: [] });
    app.renderDeadlines();
    const todaySection = document.getElementById('deadlineToday');
    expect(todaySection.querySelector('.deadline-empty')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderTaskList – DOM content
// ---------------------------------------------------------------------------
describe('renderTaskList – DOM content', () => {
  it('renders the task description in the list item', () => {
    app.setState({
      tasks: [makeTask({ id: '1', desc: 'Write unit tests' })],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    expect(document.getElementById('taskList').textContent).toContain('Write unit tests');
  });

  it('renders tasks with the correct priority CSS class', () => {
    app.setState({
      tasks: [makeTask({ id: '1', priority: 'high' })],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const item = document.querySelector('.task-item');
    expect(item.classList.contains('priority-high')).toBe(true);
  });

  it('adds "done" CSS class to completed tasks', () => {
    app.setState({
      tasks: [makeTask({ id: '1', done: true })],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const item = document.querySelector('.task-item');
    expect(item.classList.contains('done')).toBe(true);
  });

  it('renders the subject badge when the task has a subject', () => {
    app.setState({
      subjects: [{ id: 's1', name: 'Chemistry', color: '#38b2ac', grade: '' }],
      tasks: [makeTask({ id: '1', subjectId: 's1' })],
      filter: 'all',
      search: '',
    });
    app.renderTaskList();
    const badge = document.querySelector('.task-subject-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Chemistry');
  });

  it('renders multiple tasks', () => {
    app.setState({
      tasks: [makeTask({ id: '1' }), makeTask({ id: '2' }), makeTask({ id: '3' })],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    expect(document.querySelectorAll('.task-item').length).toBe(3);
  });

  it('escapes HTML in task description to prevent XSS', () => {
    app.setState({
      tasks: [makeTask({ id: '1', desc: '<script>alert("xss")</script>' })],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    // The literal <script> tag must NOT appear in the DOM
    const list = document.getElementById('taskList');
    expect(list.querySelector('script')).toBeNull();
    expect(list.textContent).toContain('<script>'); // visible as text, not parsed
  });
});

// ---------------------------------------------------------------------------
// SUBJECT_COLORS
// ---------------------------------------------------------------------------
describe('SUBJECT_COLORS', () => {
  it('is a non-empty array of CSS colour strings', () => {
    const colours = app.SUBJECT_COLORS;
    expect(Array.isArray(colours)).toBe(true);
    expect(colours.length).toBeGreaterThan(0);
    colours.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
  });
});
