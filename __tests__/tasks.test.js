'use strict';

/**
 * Tests for task filtering (getFilteredTasks), task sorting inside
 * renderTaskList, and the getSubject helper.
 */

let app;

// Helper to build a minimal task object
function makeTask(overrides = {}) {
  return {
    id:        overrides.id        ?? String(Date.now() + Math.random()),
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
// getSubject
// ---------------------------------------------------------------------------
describe('getSubject', () => {
  it('returns the matching subject by id', () => {
    app.setState({ subjects: [{ id: '10', name: 'Math', color: '#667eea', grade: '' }] });
    const s = app.getSubject('10');
    expect(s).not.toBeNull();
    expect(s.name).toBe('Math');
  });

  it('returns null for an unknown id', () => {
    app.setState({ subjects: [] });
    expect(app.getSubject('999')).toBeNull();
  });

  it('returns null when subjects array is empty', () => {
    app.setState({ subjects: [] });
    expect(app.getSubject('1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getFilteredTasks – filter modes
// ---------------------------------------------------------------------------
describe('getFilteredTasks – filter modes', () => {
  const tasks = [
    makeTask({ id: '1', done: false, priority: 'high' }),
    makeTask({ id: '2', done: false, priority: 'medium' }),
    makeTask({ id: '3', done: true,  priority: 'low' }),
    makeTask({ id: '4', done: false, priority: 'low' }),
    makeTask({ id: '5', done: true,  priority: 'high' }),
  ];

  beforeEach(() => {
    app.setState({ tasks, subjects: [], filter: 'all', search: '' });
  });

  it('"all" returns every task', () => {
    app.setState({ filter: 'all' });
    expect(app.getFilteredTasks()).toHaveLength(5);
  });

  it('"open" returns only undone tasks', () => {
    app.setState({ filter: 'open' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(3);
    result.forEach(t => expect(t.done).toBe(false));
  });

  it('"done" returns only completed tasks', () => {
    app.setState({ filter: 'done' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(2);
    result.forEach(t => expect(t.done).toBe(true));
  });

  it('"high" returns only high-priority tasks regardless of done state', () => {
    app.setState({ filter: 'high' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(2);
    result.forEach(t => expect(t.priority).toBe('high'));
  });

  it('"medium" returns only medium-priority tasks', () => {
    app.setState({ filter: 'medium' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('"low" returns only low-priority tasks', () => {
    app.setState({ filter: 'low' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(2);
    result.forEach(t => expect(t.priority).toBe('low'));
  });
});

// ---------------------------------------------------------------------------
// getFilteredTasks – search
// ---------------------------------------------------------------------------
describe('getFilteredTasks – search', () => {
  beforeEach(() => {
    app.setState({
      subjects: [{ id: 's1', name: 'Biology', color: '#48bb78', grade: '' }],
      tasks: [
        makeTask({ id: '1', desc: 'Read chapter 5', notes: '', subjectId: '' }),
        makeTask({ id: '2', desc: 'Write essay', notes: 'about history', subjectId: '' }),
        makeTask({ id: '3', desc: 'Study formulas', notes: '', subjectId: 's1' }),
      ],
      filter: 'all',
      search: '',
    });
  });

  it('returns all tasks when search is empty', () => {
    app.setState({ search: '' });
    expect(app.getFilteredTasks()).toHaveLength(3);
  });

  it('filters by description (case-insensitive)', () => {
    app.setState({ search: 'chapter' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by notes (case-insensitive)', () => {
    app.setState({ search: 'history' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by subject name (case-insensitive)', () => {
    app.setState({ search: 'biology' });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty array when nothing matches', () => {
    app.setState({ search: 'xyzzy' });
    expect(app.getFilteredTasks()).toHaveLength(0);
  });

  it('combines search with a filter mode', () => {
    // filter=open AND desc contains "chapter"
    app.setState({
      filter: 'open',
      search: 'chapter',
      tasks: [
        makeTask({ id: '1', desc: 'Read chapter 5', done: false }),
        makeTask({ id: '2', desc: 'Read chapter 6', done: true }),
      ],
    });
    const result = app.getFilteredTasks();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// Task sorting in renderTaskList
// ---------------------------------------------------------------------------
describe('renderTaskList – task sorting', () => {
  it('renders undone tasks before done tasks', () => {
    app.setState({
      tasks: [
        makeTask({ id: 'done1',  done: true,  priority: 'high',   desc: 'Done task' }),
        makeTask({ id: 'open1',  done: false, priority: 'medium', desc: 'Open task' }),
      ],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const items = document.querySelectorAll('.task-item');
    expect(items[0].dataset.taskId).toBe('open1');
    expect(items[1].dataset.taskId).toBe('done1');
  });

  it('sorts undone tasks by priority: high → medium → low', () => {
    app.setState({
      tasks: [
        makeTask({ id: 'low1',    done: false, priority: 'low',    deadline: '' }),
        makeTask({ id: 'high1',   done: false, priority: 'high',   deadline: '' }),
        makeTask({ id: 'medium1', done: false, priority: 'medium', deadline: '' }),
      ],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const items = document.querySelectorAll('.task-item');
    expect(items[0].dataset.taskId).toBe('high1');
    expect(items[1].dataset.taskId).toBe('medium1');
    expect(items[2].dataset.taskId).toBe('low1');
  });

  it('within the same priority, sorts by earlier deadline first', () => {
    app.setState({
      tasks: [
        makeTask({ id: 'later',   done: false, priority: 'medium', deadline: '2024-06-20' }),
        makeTask({ id: 'earlier', done: false, priority: 'medium', deadline: '2024-06-10' }),
      ],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const items = document.querySelectorAll('.task-item');
    expect(items[0].dataset.taskId).toBe('earlier');
    expect(items[1].dataset.taskId).toBe('later');
  });

  it('within the same priority, puts tasks with a deadline before tasks without one', () => {
    app.setState({
      tasks: [
        makeTask({ id: 'no-dl',   done: false, priority: 'low', deadline: '' }),
        makeTask({ id: 'has-dl',  done: false, priority: 'low', deadline: '2024-06-25' }),
      ],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const items = document.querySelectorAll('.task-item');
    expect(items[0].dataset.taskId).toBe('has-dl');
    expect(items[1].dataset.taskId).toBe('no-dl');
  });

  it('shows empty-state placeholder when no tasks match the filter', () => {
    app.setState({ tasks: [], filter: 'all', search: '', subjects: [] });
    app.renderTaskList();
    const emptyEl = document.getElementById('taskEmpty');
    expect(emptyEl.style.display).not.toBe('none');
  });

  it('hides empty-state placeholder when tasks exist', () => {
    app.setState({
      tasks: [makeTask({ id: '1' })],
      filter: 'all',
      search: '',
      subjects: [],
    });
    app.renderTaskList();
    const emptyEl = document.getElementById('taskEmpty');
    expect(emptyEl.style.display).toBe('none');
  });
});
