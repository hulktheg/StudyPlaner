// ============================================================
//  StudyPlaner – app.js
//  Full interactivity: timetable, homework, deadlines,
//  dark mode, local storage, Pomodoro, stats, settings,
//  export/import, notifications, mini calendar, grades
// ============================================================

/* ----------------------------------------------------------------
   Constants & Config
---------------------------------------------------------------- */
const DAYS_SHORT  = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYS_FULL   = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const SUBJECT_COLORS = [
  '#667eea', '#ed64a6', '#48bb78', '#ed8936', '#38b2ac',
  '#e53e3e', '#805ad5', '#d69e2e', '#3182ce', '#319795',
  '#f6ad55', '#68d391', '#76e4f7', '#b794f4', '#fc8181'
];

/* ----------------------------------------------------------------
   Default State
---------------------------------------------------------------- */
const DEFAULT_SETTINGS = {
  periods: 8,
  startHour: 8,
  periodDuration: 45,
  showSaturday: false,
  abWeek: false,
  notificationsEnabled: true,
  reminderDays: 1,
  pomodoroWork: 25,
  pomodoroBreak: 5,
};

let state = {
  theme: 'light',
  subjects: [],      // [{ id, name, color, grade? }]
  timetable: {},     // { "p-d": subjectId }
  timetableB: {},    // A/B week variant
  currentWeek: 'A',
  tasks: [],         // [{ id, subjectId, desc, notes, deadline, priority, done, createdAt, doneAt? }]
  filter: 'all',
  search: '',
  selectedColor: SUBJECT_COLORS[0],
  editingCell: null,
  editingTaskId: null,
  settings: { ...DEFAULT_SETTINGS },
};

/* ----------------------------------------------------------------
   Persistence
---------------------------------------------------------------- */
function saveState() {
  try {
    // Don't persist transient UI state
    const { editingCell, editingTaskId, ...persist } = state;
    localStorage.setItem('studyplaner_v3', JSON.stringify(persist));
  } catch (e) {
    console.warn('LocalStorage save failed', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('studyplaner_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Deep-merge settings so new keys get defaults
      parsed.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
      state = { ...state, ...parsed };
    }
    // Migrate from old v2 key
    if (!localStorage.getItem('studyplaner_v3')) {
      const old = localStorage.getItem('studyplaner_v2');
      if (old) {
        try {
          const op = JSON.parse(old);
          state.subjects  = op.subjects  || [];
          state.timetable = op.timetable || {};
          state.tasks     = (op.tasks || []).map(t => ({ notes: '', ...t }));
          state.theme     = op.theme || 'light';
          saveState();
        } catch (_) {}
      }
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
   Mobile Tabs + Swipe
---------------------------------------------------------------- */
function activateMobileTab(target) {
  document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.mobile-tab[data-tab="${target}"]`);
  if (btn) btn.classList.add('active');

  document.querySelector('.panel-left').classList.remove('tab-active');
  $('tabHomework').classList.remove('tab-active');
  $('tabDeadlines').classList.remove('tab-active');
  $('statsCard').classList.remove('tab-active');

  if (target === 'timetable') {
    document.querySelector('.panel-left').classList.add('tab-active');
  } else if (target === 'homework') {
    $('tabHomework').classList.add('tab-active');
  } else if (target === 'deadlines') {
    $('tabDeadlines').classList.add('tab-active');
    $('statsCard').classList.add('tab-active');
  }
}

function initMobileTabs() {
  document.querySelectorAll('.mobile-tab').forEach(tab => {
    tab.addEventListener('click', () => activateMobileTab(tab.dataset.tab));
  });
}

// Swipe gestures on main
function initSwipe() {
  const tabs = ['timetable', 'homework', 'deadlines'];
  let touchStartX = 0;
  const main = document.querySelector('.main-layout');
  main.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  main.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 60) return;
    const active = document.querySelector('.mobile-tab.active');
    if (!active) return;
    const idx = tabs.indexOf(active.dataset.tab);
    if (dx < 0 && idx < tabs.length - 1) activateMobileTab(tabs[idx + 1]);
    if (dx > 0 && idx > 0) activateMobileTab(tabs[idx - 1]);
  }, { passive: true });
}

/* ----------------------------------------------------------------
   Color Swatches
---------------------------------------------------------------- */
function renderColorSwatches() {
  const container = $('colorSwatches');
  container.innerHTML = '';
  SUBJECT_COLORS.forEach(color => {
    const swatch = el('button', 'color-swatch');
    swatch.style.background = color;
    swatch.title = color;
    swatch.type = 'button';
    swatch.setAttribute('aria-label', `Farbe ${color}`);
    if (color === state.selectedColor) {
      swatch.classList.add('selected');
      swatch.setAttribute('aria-pressed', 'true');
    } else {
      swatch.setAttribute('aria-pressed', 'false');
    }
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
  const gradeInput = $('newSubjectGrade');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.style.animation = 'shake 0.4s ease';
    setTimeout(() => nameInput.style.animation = '', 400);
    return;
  }
  if (state.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    alert('Dieses Fach existiert bereits!');
    return;
  }
  const grade = gradeInput.value.trim() || '';
  const id = Date.now().toString();
  state.subjects.push({ id, name, color: state.selectedColor, grade });

  const nextIdx = (SUBJECT_COLORS.indexOf(state.selectedColor) + 1) % SUBJECT_COLORS.length;
  state.selectedColor = SUBJECT_COLORS[nextIdx];

  nameInput.value = '';
  gradeInput.value = '';
  saveState();
  renderColorSwatches();
  renderSubjectLegend();
  updateSubjectSelects();
  renderTimetable();
  renderSubjectOverview();
}

function removeSubject(id) {
  if (!confirm('Fach entfernen? Alle zugehörigen Einträge werden gelöscht.')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  ['timetable', 'timetableB'].forEach(key => {
    Object.keys(state[key]).forEach(k => {
      if (state[key][k] === id) delete state[key][k];
    });
  });
  state.tasks = state.tasks.filter(t => t.subjectId !== id);
  saveState();
  renderSubjectLegend();
  updateSubjectSelects();
  renderTimetable();
  renderTaskList();
  renderDeadlines();
  updateProgress();
  renderSubjectOverview();
  renderStats();
}

function getSubject(id) {
  return state.subjects.find(s => s.id === id) || null;
}

function renderSubjectLegend() {
  const legend = $('subjectLegend');
  legend.innerHTML = '';
  state.subjects.forEach((s, idx) => {
    const tag = el('div', 'subject-tag');
    tag.style.background = s.color;
    tag.draggable = true;
    tag.dataset.subjectId = s.id;
    tag.setAttribute('aria-label', `Fach ${s.name}`);

    const nameSpan = el('span', '', escapeHtml(s.name));
    tag.appendChild(nameSpan);

    if (s.grade) {
      const gradeSpan = el('span', 'subject-tag-grade', escapeHtml(s.grade));
      tag.appendChild(gradeSpan);
    }

    const removeBtn = el('button', 'subject-tag-remove', '✕');
    removeBtn.title = 'Entfernen';
    removeBtn.setAttribute('aria-label', `${s.name} entfernen`);
    removeBtn.addEventListener('click', () => removeSubject(s.id));
    tag.appendChild(removeBtn);

    // Drag-to-reorder
    tag.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', s.id);
      tag.classList.add('dragging');
    });
    tag.addEventListener('dragend', () => tag.classList.remove('dragging'));
    tag.addEventListener('dragover', e => { e.preventDefault(); tag.classList.add('drag-over'); });
    tag.addEventListener('dragleave', () => tag.classList.remove('drag-over'));
    tag.addEventListener('drop', e => {
      e.preventDefault();
      tag.classList.remove('drag-over');
      const fromId = e.dataTransfer.getData('text/plain');
      if (fromId === s.id) return;
      const fromIdx = state.subjects.findIndex(x => x.id === fromId);
      const toIdx = state.subjects.findIndex(x => x.id === s.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = state.subjects.splice(fromIdx, 1);
      state.subjects.splice(toIdx, 0, moved);
      saveState();
      renderSubjectLegend();
      updateSubjectSelects();
    });

    legend.appendChild(tag);
  });
}

function updateSubjectSelects() {
  ['taskSubject', 'cellSubjectSelect'].forEach(selectId => {
    const select = $(selectId);
    if (!select) return;
    const currentVal = select.value;
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

/* Subject Overview Card */
function renderSubjectOverview() {
  const body = $('subjectOverviewBody');
  if (!body || body.hidden) return;
  body.innerHTML = '';
  if (state.subjects.length === 0) {
    body.innerHTML = '<p class="deadline-empty">Keine Fächer vorhanden.</p>';
    return;
  }
  state.subjects.forEach(s => {
    const openTasks = state.tasks.filter(t => t.subjectId === s.id && !t.done).length;
    const allTasks  = state.tasks.filter(t => t.subjectId === s.id).length;
    const row = el('div', 'subject-overview-row');
    const dot = el('span', 'subject-ov-dot');
    dot.style.background = s.color;
    const name = el('span', 'subject-ov-name', escapeHtml(s.name));
    const meta = el('span', 'subject-ov-meta', `${openTasks} offen / ${allTasks} gesamt`);
    if (s.grade) {
      const grade = el('span', 'subject-ov-grade', `Ø ${escapeHtml(s.grade)}`);
      row.appendChild(grade);
    }
    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(meta);
    body.appendChild(row);
  });
}

$('toggleSubjectOverview').addEventListener('click', () => {
  const body = $('subjectOverviewBody');
  const btn  = $('toggleSubjectOverview');
  const open = body.hidden;
  body.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  btn.querySelector('.toggle-arrow').textContent = open ? '▴' : '▾';
  if (open) renderSubjectOverview();
});

/* ----------------------------------------------------------------
   Timetable
---------------------------------------------------------------- */
function getTimetableData() {
  return state.currentWeek === 'B' ? state.timetableB : state.timetable;
}

function getActiveDays() {
  const count = state.settings.showSaturday ? 6 : 5;
  return DAYS_SHORT.slice(0, count);
}

function getActiveFullDays() {
  const count = state.settings.showSaturday ? 6 : 5;
  return DAYS_FULL.slice(0, count);
}

function getTodayColIndex() {
  const jsDay = new Date().getDay(); // 0=Sun
  const map = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
  return map[jsDay] !== undefined ? map[jsDay] : -1;
}

function renderTimetable() {
  const grid = $('timetable');
  const data = getTimetableData();
  const days = getActiveDays();
  const { periods, startHour, periodDuration } = state.settings;
  const todayIdx = getTodayColIndex();

  // Update grid columns
  grid.style.gridTemplateColumns = `56px repeat(${days.length}, 1fr)`;
  grid.innerHTML = '';

  // A/B toggle visibility
  $('abToggle').hidden = !state.settings.abWeek;
  if (state.settings.abWeek) {
    $('weekABtn').classList.toggle('active', state.currentWeek === 'A');
    $('weekBBtn').classList.toggle('active', state.currentWeek === 'B');
  }

  // Header: empty corner + day names
  grid.appendChild(el('div', 'timetable-header', ''));
  days.forEach((day, dIdx) => {
    const hdr = el('div', `timetable-header${dIdx === todayIdx ? ' today-col' : ''}`, day);
    grid.appendChild(hdr);
  });

  // Time rows
  for (let p = 0; p < periods; p++) {
    const startMin = startHour * 60 + p * periodDuration;
    const endMin   = startMin + periodDuration;
    const startStr = `${Math.floor(startMin / 60)}:${String(startMin % 60).padStart(2, '0')}`;
    const endStr   = `${Math.floor(endMin   / 60)}:${String(endMin   % 60).padStart(2, '0')}`;
    const timeLabel = el('div', 'timetable-time');
    timeLabel.innerHTML = `<span>${startStr}</span><span class="timetable-time-end">${endStr}</span>`;
    grid.appendChild(timeLabel);

    days.forEach((_, dayIdx) => {
      const key = `${p}-${dayIdx}`;
      const subjectId = data[key];
      const subject = subjectId ? getSubject(subjectId) : null;

      const cell = el('div', `timetable-cell${dayIdx === todayIdx ? ' today-col-cell' : ''}`);
      cell.dataset.key = key;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `${getActiveFullDays()[dayIdx]}, ${startStr} – ${endStr}: ${subject ? subject.name : 'Leer'}`);

      if (subject) {
        cell.classList.add('filled');
        cell.style.background = subject.color;
        cell.style.borderColor = subject.color;
        cell.textContent = subject.name;
      }

      cell.addEventListener('click', () => openCellModal(p, dayIdx));
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCellModal(p, dayIdx); }
      });
      grid.appendChild(cell);
    });
  }
}

function openCellModal(period, dayIdx) {
  state.editingCell = { period, dayIdx };
  const { startHour, periodDuration } = state.settings;
  const startMin = startHour * 60 + period * periodDuration;
  const startStr = `${Math.floor(startMin / 60)}:${String(startMin % 60).padStart(2, '0')}`;
  $('cellModalTitle').textContent = `${getActiveFullDays()[dayIdx]}, ${startStr} Uhr`;
  updateSubjectSelects();
  const data = getTimetableData();
  $('cellSubjectSelect').value = data[`${period}-${dayIdx}`] || '';
  openModal('cellModalOverlay');
}

$('saveCellBtn').addEventListener('click', () => {
  if (!state.editingCell) return;
  const { period, dayIdx } = state.editingCell;
  const key = `${period}-${dayIdx}`;
  const selectedId = $('cellSubjectSelect').value;
  const data = getTimetableData();
  if (selectedId) {
    data[key] = selectedId;
  } else {
    delete data[key];
  }
  saveState();
  renderTimetable();
  closeModal('cellModalOverlay');
});

$('cancelCellBtn').addEventListener('click', () => closeModal('cellModalOverlay'));
$('closeCellModalBtn').addEventListener('click', () => closeModal('cellModalOverlay'));

$('clearTimetableBtn').addEventListener('click', () => {
  if (!confirm('Stundenplan leeren?')) return;
  if (state.currentWeek === 'B') {
    state.timetableB = {};
  } else {
    state.timetable = {};
  }
  saveState();
  renderTimetable();
});

$('addSubjectBtn').addEventListener('click', addSubject);
$('newSubjectName').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addSubject(); }
});

// A/B week buttons
$('weekABtn').addEventListener('click', () => {
  state.currentWeek = 'A';
  renderTimetable();
});
$('weekBBtn').addEventListener('click', () => {
  state.currentWeek = 'B';
  renderTimetable();
});

/* ----------------------------------------------------------------
   Tasks
---------------------------------------------------------------- */
function openAddTaskModal() {
  state.editingTaskId = null;
  $('modalTitle').textContent = 'Neue Aufgabe';
  $('taskForm').reset();
  $('taskDesc').removeAttribute('aria-invalid');
  $('taskDescError').hidden = true;
  updateSubjectSelects();
  $('taskDeadline').value = new Date().toISOString().split('T')[0];
  $('taskNotes').value = '';
  document.querySelector('input[name="priority"][value="medium"]').checked = true;
  openModal('modalOverlay');
  setTimeout(() => $('taskDesc').focus(), 100);
}

function openEditTaskModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  state.editingTaskId = taskId;
  $('modalTitle').textContent = 'Aufgabe bearbeiten';
  $('taskDesc').removeAttribute('aria-invalid');
  $('taskDescError').hidden = true;
  updateSubjectSelects();
  $('taskSubject').value  = task.subjectId || '';
  $('taskDesc').value     = task.desc;
  $('taskNotes').value    = task.notes || '';
  $('taskDeadline').value = task.deadline || '';
  const pi = document.querySelector(`input[name="priority"][value="${task.priority}"]`);
  if (pi) pi.checked = true;
  openModal('modalOverlay');
}

$('openAddTaskBtn').addEventListener('click', openAddTaskModal);
$('cancelTaskBtn').addEventListener('click', () => closeModal('modalOverlay'));
$('closeModalBtn').addEventListener('click', () => closeModal('modalOverlay'));

$('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const subjectId = $('taskSubject').value;
  const desc      = $('taskDesc').value.trim();
  const notes     = $('taskNotes').value.trim();
  const deadline  = $('taskDeadline').value;
  const priority  = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
  if (!desc) {
    $('taskDesc').setAttribute('aria-invalid', 'true');
    $('taskDescError').hidden = false;
    $('taskDesc').focus();
    return;
  }
  $('taskDesc').setAttribute('aria-invalid', 'false');
  $('taskDescError').hidden = true;

  if (state.editingTaskId) {
    const task = state.tasks.find(t => t.id === state.editingTaskId);
    if (task) { task.subjectId = subjectId; task.desc = desc; task.notes = notes; task.deadline = deadline; task.priority = priority; }
  } else {
    state.tasks.push({ id: Date.now().toString(), subjectId, desc, notes, deadline, priority, done: false, createdAt: new Date().toISOString(), doneAt: null });
  }

  saveState();
  closeModal('modalOverlay');
  renderTaskList();
  renderDeadlines();
  renderMiniCalendar();
  updateProgress();
  updateOverdueBadge();
  renderStats();
});

function toggleTaskDone(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  saveState();
  renderTaskList();
  renderDeadlines();
  updateProgress();
  updateOverdueBadge();
  renderStats();
}

function deleteTask(taskId) {
  const item = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (item) {
    item.classList.add('removing');
    setTimeout(() => _removeTask(taskId), 280);
  } else {
    _removeTask(taskId);
  }
}

function _removeTask(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveState();
  renderTaskList();
  renderDeadlines();
  renderMiniCalendar();
  updateProgress();
  updateOverdueBadge();
  renderStats();
}

function snoozeTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.deadline) return;
  const d = new Date(task.deadline + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  task.deadline = dateOnly(d);
  saveState();
  renderTaskList();
  renderDeadlines();
  renderMiniCalendar();
  updateOverdueBadge();
}

/* Search */
$('taskSearch').addEventListener('input', () => {
  state.search = $('taskSearch').value.trim().toLowerCase();
  renderTaskList();
});

/* Filter */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    renderTaskList();
  });
});

/* Clear completed */
$('clearDoneBtn').addEventListener('click', () => {
  const count = state.tasks.filter(t => t.done).length;
  if (count === 0) { alert('Keine erledigten Aufgaben vorhanden.'); return; }
  if (!confirm(`${count} erledigte Aufgabe(n) löschen?`)) return;
  state.tasks = state.tasks.filter(t => !t.done);
  saveState();
  renderTaskList();
  renderDeadlines();
  renderMiniCalendar();
  updateProgress();
  updateOverdueBadge();
  renderStats();
});

function getFilteredTasks() {
  return state.tasks.filter(t => {
    // Search
    if (state.search) {
      const haystack = [t.desc, t.notes || '', getSubject(t.subjectId)?.name || ''].join(' ').toLowerCase();
      if (!haystack.includes(state.search)) return false;
    }
    // Filter
    if (state.filter === 'open')   return !t.done;
    if (state.filter === 'done')   return t.done;
    if (state.filter === 'high')   return t.priority === 'high';
    if (state.filter === 'medium') return t.priority === 'medium';
    if (state.filter === 'low')    return t.priority === 'low';
    return true;
  });
}

function renderTaskList() {
  const list = $('taskList');
  const filtered = getFilteredTasks();
  const po = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return po[a.priority] - po[b.priority];
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const emptyEl = $('taskEmpty');
  list.innerHTML = '';
  list.appendChild(emptyEl);

  if (sorted.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  sorted.forEach(task => list.appendChild(createTaskElement(task)));
}

function createTaskElement(task) {
  const subject = getSubject(task.subjectId);
  const item = el('div', `task-item priority-${task.priority}${task.done ? ' done' : ''}`);
  item.dataset.taskId = task.id;
  item.setAttribute('role', 'listitem');

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', `Aufgabe als erledigt markieren: ${task.desc}`);
  checkbox.addEventListener('change', () => toggleTaskDone(task.id));

  // Body
  const body = el('div', 'task-body');

  // Top: badge + priority
  const top = el('div', 'task-top');
  if (subject) {
    const badge = el('span', 'task-subject-badge', escapeHtml(subject.name));
    badge.style.background = subject.color;
    top.appendChild(badge);
  }
  top.appendChild(el('span', `priority-chip ${task.priority}`, priorityLabel(task.priority)));

  // Description
  const desc = el('div', 'task-desc', escapeHtml(task.desc));

  // Notes (collapsible)
  let notesEl = null;
  if (task.notes) {
    notesEl = el('div', 'task-notes collapsed', escapeHtml(task.notes));
  }

  // Meta: deadline (due-in badge) + snooze
  const meta = el('div', 'task-meta');
  if (task.deadline && !task.done) {
    const daysLeft = daysUntil(task.deadline);
    const dueLabel = dueBadgeLabel(daysLeft);
    const dl = el('span', `task-deadline${daysLeft < 0 ? ' overdue' : daysLeft <= 1 ? ' urgent' : ''}`, `📅 ${dueLabel}`);
    meta.appendChild(dl);

    const snoozeBtn = el('button', 'btn-snooze', '💤 +1 Tag');
    snoozeBtn.title = 'Deadline um 1 Tag verschieben';
    snoozeBtn.addEventListener('click', e => { e.stopPropagation(); snoozeTask(task.id); });
    meta.appendChild(snoozeBtn);
  } else if (task.deadline && task.done) {
    meta.appendChild(el('span', 'task-deadline', `📅 ${formatDate(task.deadline)}`));
  }

  body.appendChild(top);
  body.appendChild(desc);

  // Notes toggle
  if (task.notes) {
    const notesToggle = el('button', 'btn-notes-toggle', '📝 Notizen');
    notesToggle.setAttribute('aria-expanded', 'false');
    notesToggle.addEventListener('click', e => {
      e.stopPropagation();
      const expanded = notesEl.classList.toggle('expanded');
      notesEl.classList.toggle('collapsed', !expanded);
      notesToggle.setAttribute('aria-expanded', String(expanded));
    });
    body.appendChild(notesToggle);
    body.appendChild(notesEl);
  }

  if (meta.children.length > 0) body.appendChild(meta);

  // Actions
  const actions = el('div', 'task-actions');
  const editBtn = el('button', 'btn btn-secondary btn-sm', '✏️');
  editBtn.title = 'Bearbeiten';
  editBtn.setAttribute('aria-label', `Aufgabe bearbeiten: ${task.desc}`);
  editBtn.addEventListener('click', () => openEditTaskModal(task.id));

  const delBtn = el('button', 'btn btn-danger', '🗑️');
  delBtn.title = 'Löschen';
  delBtn.setAttribute('aria-label', `Aufgabe löschen: ${task.desc}`);
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
  const today    = dateOnly(new Date());
  const tomorrow = addDays(today, 1);
  const weekEnd  = addDays(today, 6);
  const twoWeekEnd = addDays(today, 13);

  const openTasks = state.tasks.filter(t => !t.done && t.deadline);
  const overdue   = openTasks.filter(t => t.deadline < today);
  const todayT    = openTasks.filter(t => t.deadline === today);
  const tomorrowT = openTasks.filter(t => t.deadline === tomorrow);
  const weekT     = openTasks.filter(t => t.deadline > tomorrow && t.deadline <= weekEnd);
  const twoWeekT  = openTasks.filter(t => t.deadline > weekEnd && t.deadline <= twoWeekEnd);
  const laterT    = openTasks.filter(t => t.deadline > twoWeekEnd);

  renderDeadlineList('deadlineToday',    [...overdue, ...todayT], 'today');
  renderDeadlineList('deadlineTomorrow', tomorrowT, 'tomorrow');
  renderDeadlineList('deadlineWeek',     weekT,     'week');
  renderDeadlineList('deadlineTwoWeeks', twoWeekT,  'twoweeks');
  renderDeadlineList('deadlineLater',    laterT,    'later');
  updateOverdueBadge();
}

function renderDeadlineList(containerId, tasks, type) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (tasks.length === 0) {
    const msgs = {
      today: 'Keine Aufgaben für heute 🎉',
      tomorrow: 'Keine Aufgaben für morgen',
      week: 'Keine weiteren Aufgaben diese Woche',
      twoweeks: 'Keine weiteren Aufgaben',
      later: 'Keine weiteren Aufgaben',
    };
    container.appendChild(el('p', 'deadline-empty', msgs[type] || ''));
    return;
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    const po = { high: 0, medium: 1, low: 2 };
    return po[a.priority] - po[b.priority];
  });

  sorted.forEach(task => {
    const subject = getSubject(task.subjectId);
    const item = el('div', `deadline-item ${getUrgency(task.deadline)}`);

    const dot = el('div', 'deadline-dot');
    dot.style.background = subject ? subject.color : '#a0aec0';

    const info = el('div', 'deadline-info');
    info.appendChild(el('div', 'deadline-task-desc', escapeHtml(task.desc)));
    info.appendChild(el('div', 'deadline-task-subject', subject ? escapeHtml(subject.name) : 'Kein Fach'));

    const days = daysUntil(task.deadline);
    const dateEl = el('div', 'deadline-date', dueBadgeLabel(days));

    item.appendChild(dot);
    item.appendChild(info);
    item.appendChild(dateEl);
    container.appendChild(item);
  });
}

function updateOverdueBadge() {
  const today = dateOnly(new Date());
  const count = state.tasks.filter(t => !t.done && t.deadline && t.deadline < today).length;
  const badge = $('overdueBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ----------------------------------------------------------------
   Mini Calendar
---------------------------------------------------------------- */
function renderMiniCalendar() {
  const cal = $('miniCalendar');
  if (!cal) return;
  cal.innerHTML = '';

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = dateOnly(now);

  // Tasks with deadlines this month
  const tasksByDate = {};
  state.tasks.filter(t => t.deadline && !t.done).forEach(t => {
    const d = new Date(t.deadline + 'T12:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const k = t.deadline;
      tasksByDate[k] = (tasksByDate[k] || 0) + 1;
    }
  });

  const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                      'Juli','August','September','Oktober','November','Dezember'];

  const header = el('div', 'cal-header');
  header.innerHTML = `<span class="cal-month-name">${monthNames[month]} ${year}</span>`;
  cal.appendChild(header);

  const dayNames = el('div', 'cal-day-names');
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d => {
    dayNames.appendChild(el('span', 'cal-day-name', d));
  });
  cal.appendChild(dayNames);

  const grid = el('div', 'cal-grid');

  // First day of month (JS: 0=Sun) → shift to Mon-based
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = (firstDow === 0 ? 6 : firstDow - 1);
  for (let i = 0; i < startOffset; i++) {
    grid.appendChild(el('span', 'cal-day empty', ''));
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEl = el('div', `cal-day${dateStr === today ? ' cal-today' : ''}${tasksByDate[dateStr] ? ' cal-has-tasks' : ''}`);
    dayEl.textContent = d;
    if (tasksByDate[dateStr]) {
      const dot = el('span', 'cal-dot', '');
      dayEl.appendChild(dot);
      dayEl.title = `${tasksByDate[dateStr]} Aufgabe(n)`;
    }
    grid.appendChild(dayEl);
  }

  cal.appendChild(grid);
}

/* ----------------------------------------------------------------
   Progress
---------------------------------------------------------------- */
function updateProgress() {
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  $('progressText').textContent = `${done} von ${total} erledigt`;
  $('progressBarFill').style.width = `${pct}%`;
}

/* ----------------------------------------------------------------
   Statistics
---------------------------------------------------------------- */
$('toggleStats').addEventListener('click', () => {
  const body = $('statsBody');
  const btn  = $('toggleStats');
  const open = body.hidden;
  body.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  btn.querySelector('.toggle-arrow').textContent = open ? '▴' : '▾';
  if (open) renderStats();
});

function getWeekRange(weeksAgo) {
  const now = new Date();
  const day = now.getDay() || 7; // Mon=1..Sun=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1) - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function renderStats() {
  const body = $('statsBody');
  if (!body || body.hidden) return;

  const thisWeek = getWeekRange(0);
  const lastWeek = getWeekRange(1);

  const doneTasks = state.tasks.filter(t => t.done && t.doneAt);
  const thisCount = doneTasks.filter(t => { const d = new Date(t.doneAt); return d >= thisWeek.start && d <= thisWeek.end; }).length;
  const lastCount = doneTasks.filter(t => { const d = new Date(t.doneAt); return d >= lastWeek.start && d <= lastWeek.end; }).length;

  // Bar chart
  drawStatsChart(thisCount, lastCount);

  // Open tasks by subject
  const list = $('statsSubjectList');
  list.innerHTML = '';
  const bySubject = {};
  state.tasks.filter(t => !t.done).forEach(t => {
    const name = getSubject(t.subjectId)?.name || 'Kein Fach';
    bySubject[name] = (bySubject[name] || 0) + 1;
  });
  const entries = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    list.innerHTML = '<p class="deadline-empty">Keine offenen Aufgaben.</p>';
  } else {
    const max = entries[0][1];
    entries.forEach(([name, count]) => {
      const row = el('div', 'stats-bar-row');
      const label = el('span', 'stats-bar-label', escapeHtml(name));
      const barWrap = el('div', 'stats-bar-wrap');
      const bar = el('div', 'stats-bar-fill');
      bar.style.width = `${Math.round((count / max) * 100)}%`;
      const cnt = el('span', 'stats-bar-count', String(count));
      barWrap.appendChild(bar);
      row.appendChild(label);
      row.appendChild(barWrap);
      row.appendChild(cnt);
      list.appendChild(row);
    });
  }

  // Avg lead time
  const withLeadTime = doneTasks.filter(t => t.deadline && t.doneAt);
  if (withLeadTime.length === 0) {
    $('statsLeadTime').textContent = '–';
  } else {
    const avg = withLeadTime.reduce((sum, t) => {
      const dl   = new Date(t.deadline + 'T12:00:00');
      const done = new Date(t.doneAt);
      return sum + (dl - done) / 86400000;
    }, 0) / withLeadTime.length;
    $('statsLeadTime').textContent = avg >= 0
      ? `${avg.toFixed(1)} Tage vor Deadline`
      : `${Math.abs(avg).toFixed(1)} Tage nach Deadline`;
  }
}

function drawStatsChart(thisCount, lastCount) {
  const canvas = $('statsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 380;
  canvas.width = W;
  ctx.clearRect(0, 0, W, canvas.height);

  const H = canvas.height;
  const max = Math.max(thisCount, lastCount, 1);
  const barW = 60;
  const gap = 40;
  const pad = 30;
  const maxH = H - 40;

  const isDark = document.body.dataset.theme === 'dark';
  const textColor = isDark ? '#a0aec0' : '#718096';
  const barColorThis = '#667eea';
  const barColorLast = isDark ? '#2d3748' : '#e2e8f0';

  const drawBar = (x, count, color, label) => {
    const bh = Math.max(4, Math.round((count / max) * maxH));
    // Draw rounded rect with fallback for older browsers
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, H - 20 - bh, barW, bh, 4);
    } else {
      const r = Math.min(4, bh / 2, barW / 2);
      const lx = x, ly = H - 20 - bh, lw = barW, lh = bh;
      ctx.moveTo(lx + r, ly);
      ctx.lineTo(lx + lw - r, ly);
      ctx.arcTo(lx + lw, ly, lx + lw, ly + r, r);
      ctx.lineTo(lx + lw, ly + lh);
      ctx.lineTo(lx, ly + lh);
      ctx.lineTo(lx, ly + r);
      ctx.arcTo(lx, ly, lx + r, ly, r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(count), x + barW / 2, H - 20 - bh - 6);
    ctx.fillText(label, x + barW / 2, H - 4);
  };

  const startX = (W - 2 * barW - gap) / 2;
  drawBar(startX, lastCount, barColorLast, 'Letzte Woche');
  drawBar(startX + barW + gap, thisCount, barColorThis, 'Diese Woche');
}

/* ----------------------------------------------------------------
   Modals
---------------------------------------------------------------- */
function openModal(overlayId) {
  const overlay = $(overlayId);
  if (!overlay) return;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Focus first focusable element
  setTimeout(() => {
    const first = overlay.querySelector('input, select, textarea, button:not(.modal-close)');
    if (first) first.focus();
  }, 50);
}

function closeModal(overlayId) {
  const overlay = $(overlayId);
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  state.editingCell = null;
  if (overlayId === 'modalOverlay') state.editingTaskId = null;
}

['modalOverlay', 'cellModalOverlay', 'settingsModalOverlay', 'exportModalOverlay'].forEach(id => {
  const el2 = $(id);
  if (el2) el2.addEventListener('click', e => { if (e.target === el2) closeModal(id); });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('modalOverlay');
    closeModal('cellModalOverlay');
    closeModal('settingsModalOverlay');
    closeModal('exportModalOverlay');
    hideShortcuts();
  }
});

/* ----------------------------------------------------------------
   Settings
---------------------------------------------------------------- */
$('settingsBtn').addEventListener('click', openSettingsModal);
$('cancelSettingsBtn').addEventListener('click', () => closeModal('settingsModalOverlay'));
$('closeSettingsModalBtn').addEventListener('click', () => closeModal('settingsModalOverlay'));

function openSettingsModal() {
  const s = state.settings;
  $('settingPeriods').value         = s.periods;
  $('settingStartHour').value       = s.startHour;
  $('settingPeriodDuration').value  = s.periodDuration;
  $('settingSaturday').checked      = s.showSaturday;
  $('settingABWeek').checked        = s.abWeek;
  $('settingNotifications').checked = s.notificationsEnabled;
  $('settingReminderDays').value    = s.reminderDays;
  $('settingPomodoroWork').value    = s.pomodoroWork;
  $('settingPomodoroBreak').value   = s.pomodoroBreak;
  openModal('settingsModalOverlay');
}

$('saveSettingsBtn').addEventListener('click', () => {
  const s = state.settings;
  s.periods         = Math.min(10, Math.max(4,  parseInt($('settingPeriods').value)        || 8));
  s.startHour       = Math.min(12, Math.max(6,  parseInt($('settingStartHour').value)      || 8));
  s.periodDuration  = Math.min(90, Math.max(30, parseInt($('settingPeriodDuration').value) || 45));
  s.showSaturday    = $('settingSaturday').checked;
  s.abWeek          = $('settingABWeek').checked;
  s.notificationsEnabled = $('settingNotifications').checked;
  s.reminderDays    = Math.min(14, Math.max(0,  parseInt($('settingReminderDays').value)   || 1));
  s.pomodoroWork    = Math.min(60, Math.max(1,  parseInt($('settingPomodoroWork').value)   || 25));
  s.pomodoroBreak   = Math.min(30, Math.max(1,  parseInt($('settingPomodoroBreak').value)  || 5));
  saveState();
  closeModal('settingsModalOverlay');
  renderTimetable();
  resetPomodoro();
});

/* ----------------------------------------------------------------
   Keyboard Shortcuts
---------------------------------------------------------------- */
$('shortcutsBtn').addEventListener('click', toggleShortcuts);
$('closeShortcutsBtn').addEventListener('click', hideShortcuts);

function toggleShortcuts() {
  const panel = $('shortcutsPanel');
  panel.hidden ? showShortcuts() : hideShortcuts();
}

function showShortcuts() {
  $('shortcutsPanel').hidden = false;
  $('shortcutsPanel').focus();
}

function hideShortcuts() {
  $('shortcutsPanel').hidden = true;
}

document.addEventListener('keydown', e => {
  // Ignore if typing in an input
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;

  switch (e.key) {
    case 'n': case 'N': e.preventDefault(); openAddTaskModal(); break;
    case 'd': case 'D': e.preventDefault(); $('themeToggle').click(); break;
    case 's': case 'S': e.preventDefault(); openSettingsModal(); break;
    case 'f': case 'F': e.preventDefault(); $('taskSearch').focus(); break;
    case 'p': case 'P': e.preventDefault(); togglePomodoro(); break;
  }
});

/* ----------------------------------------------------------------
   Export / Import
---------------------------------------------------------------- */
$('exportBtn').addEventListener('click', () => openModal('exportModalOverlay'));
$('closeExportModalBtn').addEventListener('click', () => closeModal('exportModalOverlay'));

$('exportJsonBtn').addEventListener('click', () => {
  const { editingCell, editingTaskId, ...data } = state;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'studyplaner_backup.json'; a.click();
  URL.revokeObjectURL(url);
});

$('exportCsvBtn').addEventListener('click', () => {
  const header = 'ID,Fach,Beschreibung,Notizen,Deadline,Priorität,Erledigt,Erstellt\n';
  const rows = state.tasks.map(t => {
    const subj = getSubject(t.subjectId)?.name || '';
    const row = [t.id, subj, t.desc, t.notes || '', t.deadline || '', t.priority, t.done ? 'ja' : 'nein', t.createdAt];
    return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'studyplaner_aufgaben.csv'; a.click();
  URL.revokeObjectURL(url);
});

$('importJsonBtn').addEventListener('click', () => {
  const file = $('importFileInput').files[0];
  if (!file) { alert('Bitte eine JSON-Datei auswählen.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) throw new Error('Ungültiges Format');
      if (!confirm('Alle vorhandenen Daten werden überschrieben. Fortfahren?')) return;
      parsed.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
      state = { ...state, ...parsed, editingCell: null, editingTaskId: null };
      saveState();
      renderAll();
      closeModal('exportModalOverlay');
      alert('Import erfolgreich!');
    } catch (err) {
      alert('Fehler beim Importieren: ' + err.message);
    }
  };
  reader.readAsText(file);
});

/* ----------------------------------------------------------------
   Notifications
---------------------------------------------------------------- */
function requestNotifications() {
  if (!state.settings.notificationsEnabled) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotifications() {
  if (!state.settings.notificationsEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today    = dateOnly(new Date());
  const reminder = addDays(today, state.settings.reminderDays);

  const due = state.tasks.filter(t =>
    !t.done && t.deadline && (t.deadline <= today || t.deadline === reminder)
  );

  if (due.length === 0) return;

  const overdue = due.filter(t => t.deadline < today).length;
  const todayDue = due.filter(t => t.deadline === today).length;

  let body = '';
  if (overdue > 0) body += `${overdue} überfällige Aufgabe(n). `;
  if (todayDue > 0) body += `${todayDue} Aufgabe(n) heute fällig.`;

  try {
    new Notification('📚 StudyPlaner Erinnerung', { body: body.trim(), icon: '' });
  } catch (_) {}
}

/* ----------------------------------------------------------------
   Pomodoro Timer
---------------------------------------------------------------- */
let pomTimer = null;
let pomState = { mode: 'work', remaining: 0, running: false, cycles: 0 };

function loadPomState() {
  try {
    const raw = sessionStorage.getItem('studyplaner_pomodoro');
    if (raw) pomState = { ...pomState, ...JSON.parse(raw) };
    else pomState.remaining = state.settings.pomodoroWork * 60;
  } catch (_) {
    pomState.remaining = state.settings.pomodoroWork * 60;
  }
}

function savePomState() {
  try { sessionStorage.setItem('studyplaner_pomodoro', JSON.stringify(pomState)); } catch (_) {}
}

function resetPomodoro() {
  clearInterval(pomTimer);
  pomState = { mode: 'work', remaining: state.settings.pomodoroWork * 60, running: false, cycles: 0 };
  savePomState();
  renderPomodoro();
}

function togglePomodoro() {
  if (pomState.running) {
    clearInterval(pomTimer);
    pomState.running = false;
    savePomState();
    renderPomodoro();
  } else {
    startPomodoro();
  }
}

function startPomodoro() {
  if (pomState.remaining <= 0) switchPomMode();
  pomState.running = true;
  savePomState();
  renderPomodoro();
  pomTimer = setInterval(() => {
    pomState.remaining--;
    if (pomState.remaining <= 0) {
      pomState.remaining = 0;
      clearInterval(pomTimer);
      pomState.running = false;
      if (pomState.mode === 'work') pomState.cycles++;
      notifyPomodoro();
      switchPomMode();
    }
    savePomState();
    renderPomodoro();
  }, 1000);
}

function switchPomMode() {
  pomState.mode = pomState.mode === 'work' ? 'break' : 'work';
  pomState.remaining = (pomState.mode === 'work'
    ? state.settings.pomodoroWork
    : state.settings.pomodoroBreak) * 60;
  savePomState();
  renderPomodoro();
}

function notifyPomodoro() {
  const msg = pomState.mode === 'work' ? '⏸ Pause! Du hast eine Arbeitsphase abgeschlossen.' : '▶ Weiter! Pause vorbei.';
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('🍅 Pomodoro', { body: msg }); } catch (_) {}
  }
}

function renderPomodoro() {
  const min = String(Math.floor(pomState.remaining / 60)).padStart(2, '0');
  const sec = String(pomState.remaining % 60).padStart(2, '0');
  $('pomodoroTime').textContent = `${min}:${sec}`;
  $('pomodoroMode').textContent = pomState.mode === 'work' ? 'Arbeitsphase' : 'Pause';
  $('pomodoroStartBtn').textContent = pomState.running ? '⏸ Pause' : '▶ Start';
  $('pomodoroCycles').textContent = '🍅'.repeat(Math.min(pomState.cycles, 8));
  // Color the widget based on mode
  $('pomodoroWidget').dataset.mode = pomState.mode;
}

$('pomodoroStartBtn').addEventListener('click', togglePomodoro);
$('pomodoroResetBtn').addEventListener('click', resetPomodoro);
$('pomodoroSkipBtn').addEventListener('click', () => {
  clearInterval(pomTimer);
  pomState.running = false;
  if (pomState.mode === 'work') pomState.cycles++;
  switchPomMode();
});

// Collapse/expand widget
$('pomodoroToggle').addEventListener('click', () => {
  const body = $('pomodoroBody');
  const btn  = $('pomodoroToggle');
  const collapsed = body.hidden;
  body.hidden = !collapsed;
  btn.textContent = collapsed ? '−' : '+';
  btn.setAttribute('aria-label', collapsed ? 'Timer minimieren' : 'Timer erweitern');
});

/* ----------------------------------------------------------------
   Date helpers
---------------------------------------------------------------- */
function dateOnly(d) {
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateOnly(d);
}

function daysUntil(dateStr) {
  const today = dateOnly(new Date());
  const t = new Date(today + 'T12:00:00');
  const d = new Date(dateStr + 'T12:00:00');
  return Math.round((d - t) / 86400000);
}

function dueBadgeLabel(days) {
  if (days < 0) return `Überfällig (${Math.abs(days)} Tag${Math.abs(days) !== 1 ? 'e' : ''})`;
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  return `in ${days} Tagen`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d    = new Date(dateStr + 'T12:00:00');
  const days = daysUntil(dateStr);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days < 0) return `Überfällig (${d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })})`;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

function getUrgency(dateStr) {
  if (!dateStr) return '';
  const days = daysUntil(dateStr);
  if (days < 0) return 'overdue';
  if (days <= 1) return 'urgent';
  return '';
}

function priorityLabel(p) {
  if (p === 'high')   return '🔴 Hoch';
  if (p === 'medium') return '🟡 Mittel';
  return '🟢 Niedrig';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/* ----------------------------------------------------------------
   Render all
---------------------------------------------------------------- */
function renderAll() {
  applyTheme(state.theme);
  renderColorSwatches();
  renderSubjectLegend();
  updateSubjectSelects();
  renderTimetable();
  renderTaskList();
  renderDeadlines();
  renderMiniCalendar();
  updateProgress();
  updateOverdueBadge();
  renderPomodoro();
  initMobileTabs();
  initSwipe();

  if (window.innerWidth <= 600) {
    activateMobileTab('timetable');
  }
}

/* ----------------------------------------------------------------
   Init
---------------------------------------------------------------- */
function init() {
  loadState();
  loadPomState();
  renderAll();
  requestNotifications();
  sendNotifications();
}

document.addEventListener('DOMContentLoaded', init);

/* ----------------------------------------------------------------
   Test exports – no-op in browsers; tree-shakeable in any bundler.
---------------------------------------------------------------- */
if (typeof module !== 'undefined') {
  module.exports = {
    // Pure utility functions
    escapeHtml,
    dateOnly,
    addDays,
    daysUntil,
    dueBadgeLabel,
    formatDate,
    getUrgency,
    priorityLabel,
    // Stats / week helpers
    getWeekRange,
    // Constants
    DEFAULT_SETTINGS,
    SUBJECT_COLORS,
    // State management
    saveState,
    loadState,
    getState:  () => state,
    setState:  (patch) => { state = { ...state, ...patch }; },
    // Task & subject helpers
    getFilteredTasks,
    getSubject,
    // Timetable helpers
    getTimetableData,
    getActiveDays,
    getActiveFullDays,
    getTodayColIndex,
    renderTimetable,
    // Render helpers
    renderTaskList,
    renderDeadlines,
    renderSubjectOverview,
    renderMiniCalendar,
    renderPomodoro,
    updateProgress,
    updateOverdueBadge,
    renderAll,
    renderStats,
    // Pomodoro helpers
    resetPomodoro,
    switchPomMode,
    togglePomodoro,
    deleteTask,
    getPomState: () => pomState,
    // Initialisation
    init,
  };
}
