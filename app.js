// ============================================================
//  StudyPlaner – app.js
//  Full interactivity: timetable, homework, deadlines, dark mode
// ============================================================

/* ----------------------------------------------------------------
   Constants & Config
---------------------------------------------------------------- */
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const FULL_DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const PERIODS = 8; // number of time slots
const START_HOUR = 8; // school starts at 8:00
const SUBJECT_COLORS = [
  '#667eea', '#ed64a6', '#48bb78', '#ed8936', '#38b2ac',
  '#e53e3e', '#805ad5', '#d69e2e', '#3182ce', '#319795',
  '#e53e3e', '#f6ad55', '#68d391', '#76e4f7', '#b794f4'
];

/* ----------------------------------------------------------------
   State
---------------------------------------------------------------- */
let state = {
  theme: 'light',
  subjects: [],          // [{ id, name, color }]
  timetable: {},         // { "1-0": subjectId, "2-3": subjectId, ... } key = "period-dayIndex"
  tasks: [],             // [{ id, subjectId, desc, deadline, priority, done, createdAt }]
  filter: 'all',
  selectedColor: SUBJECT_COLORS[0],
  editingCell: null,     // { period, day }
  editingTaskId: null,
};

/* ----------------------------------------------------------------
   Persistence
---------------------------------------------------------------- */
function saveState() {
  try {
    localStorage.setItem('studyplaner_v2', JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage save failed', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('studyplaner_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (e) {
    console.warn('LocalStorage load failed', e);
  }
}

/* ----------------------------------------------------------------
   DOM helpers
---------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

/* ----------------------------------------------------------------
   Theme
---------------------------------------------------------------- */
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  $('themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

$('themeToggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveState();
});

/* ----------------------------------------------------------------
   Mobile Tabs
---------------------------------------------------------------- */
function initMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      // Hide all tab panels
      document.querySelector('.panel-left').classList.remove('tab-active');
      $('tabHomework').classList.remove('tab-active');
      $('tabDeadlines').classList.remove('tab-active');

      if (target === 'timetable') {
        document.querySelector('.panel-left').classList.add('tab-active');
      } else if (target === 'homework') {
        $('tabHomework').classList.add('tab-active');
      } else if (target === 'deadlines') {
        $('tabDeadlines').classList.add('tab-active');
      }
    });
  });
}

/* ----------------------------------------------------------------
   Color Swatches
---------------------------------------------------------------- */
function renderColorSwatches() {
  const container = $('colorSwatches');
  container.innerHTML = '';
  SUBJECT_COLORS.slice(0, 10).forEach(color => {
    const swatch = el('button', 'color-swatch');
    swatch.style.background = color;
    swatch.title = color;
    swatch.type = 'button';
    if (color === state.selectedColor) swatch.classList.add('selected');
    swatch.addEventListener('click', () => {
      state.selectedColor = color;
      renderColorSwatches();
    });
    container.appendChild(swatch);
  });
}

/* ----------------------------------------------------------------
   Subjects
---------------------------------------------------------------- */
function addSubject() {
  const nameInput = $('newSubjectName');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.style.animation = 'shake 0.4s ease';
    setTimeout(() => nameInput.style.animation = '', 400);
    return;
  }
  // Prevent duplicate names
  if (state.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    alert('Dieses Fach existiert bereits!');
    return;
  }
  const id = Date.now().toString();
  state.subjects.push({ id, name, color: state.selectedColor });

  // Auto-advance color
  const nextColorIdx = (SUBJECT_COLORS.indexOf(state.selectedColor) + 1) % SUBJECT_COLORS.length;
  state.selectedColor = SUBJECT_COLORS[nextColorIdx];

  nameInput.value = '';
  saveState();
  renderColorSwatches();
  renderSubjectLegend();
  updateSubjectSelects();
  renderTimetable();
}

function removeSubject(id) {
  if (!confirm('Fach entfernen? Alle zugehörigen Einträge werden gelöscht.')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  // Remove from timetable
  Object.keys(state.timetable).forEach(key => {
    if (state.timetable[key] === id) delete state.timetable[key];
  });
  // Remove tasks
  state.tasks = state.tasks.filter(t => t.subjectId !== id);
  saveState();
  renderSubjectLegend();
  updateSubjectSelects();
  renderTimetable();
  renderTaskList();
  renderDeadlines();
  updateProgress();
}

function getSubject(id) {
  return state.subjects.find(s => s.id === id) || null;
}

function renderSubjectLegend() {
  const legend = $('subjectLegend');
  legend.innerHTML = '';
  state.subjects.forEach(s => {
    const tag = el('div', 'subject-tag');
    tag.style.background = s.color;
    tag.innerHTML = `<span>${s.name}</span>`;
    const removeBtn = el('button', 'subject-tag-remove', '✕');
    removeBtn.title = 'Entfernen';
    removeBtn.addEventListener('click', () => removeSubject(s.id));
    tag.appendChild(removeBtn);
    legend.appendChild(tag);
  });
}

function updateSubjectSelects() {
  ['taskSubject', 'cellSubjectSelect'].forEach(selectId => {
    const select = $(selectId);
    if (!select) return;
    const currentVal = select.value;
    // Keep first "placeholder" option
    while (select.options.length > 1) select.remove(1);
    state.subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
    select.value = currentVal;
  });
}

/* ----------------------------------------------------------------
   Timetable
---------------------------------------------------------------- */
function renderTimetable() {
  const grid = $('timetable');
  grid.innerHTML = '';

  // Header row: empty corner + day names
  grid.appendChild(el('div', 'timetable-header', ''));
  DAYS.forEach(day => {
    grid.appendChild(el('div', 'timetable-header', day));
  });

  // Time rows
  for (let p = 0; p < PERIODS; p++) {
    const hour = START_HOUR + p;
    const timeLabel = el('div', 'timetable-time', `${hour}:00`);
    grid.appendChild(timeLabel);

    DAYS.forEach((_, dayIdx) => {
      const key = `${p}-${dayIdx}`;
      const subjectId = state.timetable[key];
      const subject = subjectId ? getSubject(subjectId) : null;

      const cell = el('div', 'timetable-cell');
      cell.dataset.key = key;

      if (subject) {
        cell.classList.add('filled');
        cell.style.background = subject.color;
        cell.style.borderColor = subject.color;
        cell.textContent = subject.name;
      } else {
        cell.style.background = '';
        cell.textContent = '';
        cell.style.borderColor = '';
      }

      cell.addEventListener('click', () => openCellModal(p, dayIdx));
      grid.appendChild(cell);
    });
  }
}

function openCellModal(period, dayIdx) {
  state.editingCell = { period, dayIdx };
  $('cellModalTitle').textContent = `${FULL_DAYS[dayIdx]}, ${START_HOUR + period}:00 Uhr`;
  updateSubjectSelects();

  // Pre-select current subject
  const key = `${period}-${dayIdx}`;
  const subjectId = state.timetable[key] || '';
  $('cellSubjectSelect').value = subjectId;

  openModal('cellModalOverlay');
}

$('saveCellBtn').addEventListener('click', () => {
  if (!state.editingCell) return;
  const { period, dayIdx } = state.editingCell;
  const key = `${period}-${dayIdx}`;
  const selectedId = $('cellSubjectSelect').value;

  if (selectedId) {
    state.timetable[key] = selectedId;
  } else {
    delete state.timetable[key];
  }

  saveState();
  renderTimetable();
  closeModal('cellModalOverlay');
});

$('cancelCellBtn').addEventListener('click', () => closeModal('cellModalOverlay'));
$('closeCellModalBtn').addEventListener('click', () => closeModal('cellModalOverlay'));

$('clearTimetableBtn').addEventListener('click', () => {
  if (!confirm('Stundenplan leeren?')) return;
  state.timetable = {};
  saveState();
  renderTimetable();
});

$('addSubjectBtn').addEventListener('click', addSubject);

$('newSubjectName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addSubject(); }
});

/* ----------------------------------------------------------------
   Tasks
---------------------------------------------------------------- */
function openAddTaskModal() {
  state.editingTaskId = null;
  $('modalTitle').textContent = 'Neue Aufgabe';
  $('taskForm').reset();
  updateSubjectSelects();

  // Default deadline = today
  const today = new Date().toISOString().split('T')[0];
  $('taskDeadline').value = today;
  document.querySelector('input[name="priority"][value="medium"]').checked = true;

  openModal('modalOverlay');
}

function openEditTaskModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  state.editingTaskId = taskId;

  $('modalTitle').textContent = 'Aufgabe bearbeiten';
  updateSubjectSelects();

  $('taskSubject').value = task.subjectId || '';
  $('taskDesc').value = task.desc;
  $('taskDeadline').value = task.deadline || '';
  const priorityInput = document.querySelector(`input[name="priority"][value="${task.priority}"]`);
  if (priorityInput) priorityInput.checked = true;

  openModal('modalOverlay');
}

$('openAddTaskBtn').addEventListener('click', openAddTaskModal);
$('cancelTaskBtn').addEventListener('click', () => closeModal('modalOverlay'));
$('closeModalBtn').addEventListener('click', () => closeModal('modalOverlay'));

$('taskForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const subjectId = $('taskSubject').value;
  const desc = $('taskDesc').value.trim();
  const deadline = $('taskDeadline').value;
  const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';

  if (!desc) return;

  if (state.editingTaskId) {
    // Update existing
    const task = state.tasks.find(t => t.id === state.editingTaskId);
    if (task) {
      task.subjectId = subjectId;
      task.desc = desc;
      task.deadline = deadline;
      task.priority = priority;
    }
  } else {
    // New task
    state.tasks.push({
      id: Date.now().toString(),
      subjectId,
      desc,
      deadline,
      priority,
      done: false,
      createdAt: new Date().toISOString()
    });
  }

  saveState();
  closeModal('modalOverlay');
  renderTaskList();
  renderDeadlines();
  updateProgress();
});

function toggleTaskDone(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.done = !task.done;
    saveState();
    renderTaskList();
    renderDeadlines();
    updateProgress();
  }
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveState();
  renderTaskList();
  renderDeadlines();
  updateProgress();
}

/* Filtering */
$('taskForm').parentElement; // just ensure it's loaded

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    renderTaskList();
  });
});

function getFilteredTasks() {
  return state.tasks.filter(t => {
    if (state.filter === 'all') return true;
    if (state.filter === 'open') return !t.done;
    if (state.filter === 'done') return t.done;
    if (state.filter === 'high') return t.priority === 'high';
    if (state.filter === 'medium') return t.priority === 'medium';
    if (state.filter === 'low') return t.priority === 'low';
    return true;
  });
}

function renderTaskList() {
  const list = $('taskList');
  const filtered = getFilteredTasks();

  // Sort: undone first, then by priority, then by deadline
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  // Clear list keeping empty state element
  const emptyEl = $('taskEmpty');
  list.innerHTML = '';
  list.appendChild(emptyEl);

  if (sorted.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  sorted.forEach(task => {
    const item = createTaskElement(task);
    list.appendChild(item);
  });
}

function createTaskElement(task) {
  const subject = getSubject(task.subjectId);
  const item = el('div', `task-item priority-${task.priority}${task.done ? ' done' : ''}`);
  item.dataset.taskId = task.id;

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.done;
  checkbox.addEventListener('change', () => toggleTaskDone(task.id));

  // Body
  const body = el('div', 'task-body');

  // Top row: subject badge + priority
  const top = el('div', 'task-top');
  if (subject) {
    const badge = el('span', 'task-subject-badge', subject.name);
    badge.style.background = subject.color;
    top.appendChild(badge);
  }
  const chip = el('span', `priority-chip ${task.priority}`, priorityLabel(task.priority));
  top.appendChild(chip);

  // Description
  const desc = el('div', 'task-desc', escapeHtml(task.desc));

  // Meta row: deadline
  const meta = el('div', 'task-meta');
  if (task.deadline) {
    const dl = el('span', 'task-deadline', `📅 ${formatDate(task.deadline)}`);
    const urgency = getUrgency(task.deadline);
    if (urgency === 'overdue') dl.classList.add('overdue');
    if (urgency === 'urgent') dl.classList.add('urgent');
    meta.appendChild(dl);
  }

  body.appendChild(top);
  body.appendChild(desc);
  if (meta.children.length > 0) body.appendChild(meta);

  // Actions
  const actions = el('div', 'task-actions');

  const editBtn = el('button', 'btn btn-secondary btn-sm', '✏️');
  editBtn.title = 'Bearbeiten';
  editBtn.addEventListener('click', () => openEditTaskModal(task.id));

  const delBtn = el('button', 'btn btn-danger', '🗑️');
  delBtn.title = 'Löschen';
  delBtn.addEventListener('click', () => deleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  item.appendChild(checkbox);
  item.appendChild(body);
  item.appendChild(actions);

  return item;
}

/* ----------------------------------------------------------------
   Deadlines
---------------------------------------------------------------- */
function renderDeadlines() {
  const today = dateOnly(new Date());
  const tomorrow = dateOnly(new Date(Date.now() + 86400000));
  const weekEnd = dateOnly(new Date(Date.now() + 6 * 86400000));

  const openTasks = state.tasks.filter(t => !t.done && t.deadline);

  const todayTasks = openTasks.filter(t => t.deadline === today);
  const tomorrowTasks = openTasks.filter(t => t.deadline === tomorrow);
  const weekTasks = openTasks.filter(t => t.deadline > tomorrow && t.deadline <= weekEnd);
  // Also include overdue in today section
  const overdueTasks = openTasks.filter(t => t.deadline < today);
  const allTodayAndOverdue = [...overdueTasks, ...todayTasks];

  renderDeadlineList('deadlineToday', allTodayAndOverdue, 'today');
  renderDeadlineList('deadlineTomorrow', tomorrowTasks, 'tomorrow');
  renderDeadlineList('deadlineWeek', weekTasks, 'week');
}

function renderDeadlineList(containerId, tasks, type) {
  const container = $(containerId);
  container.innerHTML = '';

  if (tasks.length === 0) {
    const empty = el('p', 'deadline-empty');
    if (type === 'today') empty.textContent = 'Keine Aufgaben für heute 🎉';
    else if (type === 'tomorrow') empty.textContent = 'Keine Aufgaben für morgen';
    else empty.textContent = 'Keine weiteren Aufgaben diese Woche';
    container.appendChild(empty);
    return;
  }

  const sorted = [...tasks].sort((a, b) => {
    const po = { high: 0, medium: 1, low: 2 };
    return po[a.priority] - po[b.priority];
  });

  sorted.forEach(task => {
    const subject = getSubject(task.subjectId);
    const urgency = getUrgency(task.deadline);

    const item = el('div', `deadline-item ${urgency}`);

    const dot = el('div', 'deadline-dot');
    dot.style.background = subject ? subject.color : '#a0aec0';

    const info = el('div', 'deadline-info');
    const descEl = el('div', 'deadline-task-desc', escapeHtml(task.desc));
    const subjectEl = el('div', 'deadline-task-subject', subject ? subject.name : 'Kein Fach');
    info.appendChild(descEl);
    info.appendChild(subjectEl);

    const dateEl = el('div', 'deadline-date', formatDate(task.deadline));

    item.appendChild(dot);
    item.appendChild(info);
    item.appendChild(dateEl);
    container.appendChild(item);
  });
}

/* ----------------------------------------------------------------
   Progress
---------------------------------------------------------------- */
function updateProgress() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  $('progressText').textContent = `${done} von ${total} erledigt`;
  $('progressBarFill').style.width = `${pct}%`;
}

/* ----------------------------------------------------------------
   Modals
---------------------------------------------------------------- */
function openModal(overlayId) {
  $(overlayId).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(overlayId) {
  $(overlayId).classList.remove('active');
  document.body.style.overflow = '';
  state.editingCell = null;
  if (overlayId === 'modalOverlay') state.editingTaskId = null;
}

// Close on overlay click
['modalOverlay', 'cellModalOverlay'].forEach(id => {
  $(id).addEventListener('click', (e) => {
    if (e.target === $(id)) closeModal(id);
  });
});

// Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('modalOverlay');
    closeModal('cellModalOverlay');
  }
});

/* ----------------------------------------------------------------
   Date helpers
---------------------------------------------------------------- */
function dateOnly(d) {
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const today = dateOnly(new Date());
  const tomorrow = dateOnly(new Date(Date.now() + 86400000));

  if (dateStr === today) return 'Heute';
  if (dateStr === tomorrow) return 'Morgen';
  if (dateStr < today) return `Überfällig (${d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })})`;

  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

function getUrgency(dateStr) {
  if (!dateStr) return '';
  const today = dateOnly(new Date());
  const tomorrow = dateOnly(new Date(Date.now() + 86400000));
  if (dateStr < today) return 'overdue';
  if (dateStr === today || dateStr === tomorrow) return 'urgent';
  return '';
}

function priorityLabel(p) {
  if (p === 'high') return '🔴 Hoch';
  if (p === 'medium') return '🟡 Mittel';
  return '🟢 Niedrig';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ----------------------------------------------------------------
   Init
---------------------------------------------------------------- */
function init() {
  loadState();
  applyTheme(state.theme);
  renderColorSwatches();
  renderSubjectLegend();
  updateSubjectSelects();
  renderTimetable();
  renderTaskList();
  renderDeadlines();
  updateProgress();
  initMobileTabs();

  // Set first mobile tab active
  if (window.innerWidth <= 600) {
    document.querySelector('.panel-left').classList.add('tab-active');
  }
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
