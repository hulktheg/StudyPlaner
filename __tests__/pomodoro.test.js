'use strict';

/**
 * Tests for the Pomodoro timer helper functions.
 */

let app;

beforeEach(() => {
  app = require('../app.js');
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// resetPomodoro
// ---------------------------------------------------------------------------
describe('resetPomodoro', () => {
  it('resets mode to "work"', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
    expect(app.getPomState().mode).toBe('work');
  });

  it('resets remaining time to pomodoroWork × 60 seconds', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 30 } });
    app.resetPomodoro();
    expect(app.getPomState().remaining).toBe(30 * 60);
  });

  it('sets running to false', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
    expect(app.getPomState().running).toBe(false);
  });

  it('resets cycle count to 0', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
    expect(app.getPomState().cycles).toBe(0);
  });

  it('updates the timer DOM display', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
    expect(document.getElementById('pomodoroTime').textContent).toBe('25:00');
  });
});

// ---------------------------------------------------------------------------
// switchPomMode
// ---------------------------------------------------------------------------
describe('switchPomMode', () => {
  it('switches from work to break', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25, pomodoroBreak: 5 } });
    app.resetPomodoro(); // start in work mode
    app.switchPomMode();
    expect(app.getPomState().mode).toBe('break');
  });

  it('switches from break back to work', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25, pomodoroBreak: 5 } });
    app.resetPomodoro();
    app.switchPomMode(); // → break
    app.switchPomMode(); // → work
    expect(app.getPomState().mode).toBe('work');
  });

  it('sets remaining time to pomodoroBreak × 60 when switching to break', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25, pomodoroBreak: 10 } });
    app.resetPomodoro();
    app.switchPomMode();
    expect(app.getPomState().remaining).toBe(10 * 60);
  });

  it('sets remaining time to pomodoroWork × 60 when switching to work', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 20, pomodoroBreak: 5 } });
    app.resetPomodoro();
    app.switchPomMode(); // → break
    app.switchPomMode(); // → work
    expect(app.getPomState().remaining).toBe(20 * 60);
  });
});

// ---------------------------------------------------------------------------
// renderPomodoro
// ---------------------------------------------------------------------------
describe('renderPomodoro', () => {
  beforeEach(() => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
  });

  it('displays time in MM:SS format', () => {
    expect(document.getElementById('pomodoroTime').textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it('shows "Arbeitsphase" label during work mode', () => {
    expect(document.getElementById('pomodoroMode').textContent).toBe('Arbeitsphase');
  });

  it('shows "Pause" label during break mode', () => {
    app.switchPomMode();
    expect(document.getElementById('pomodoroMode').textContent).toBe('Pause');
  });

  it('shows ▶ Start when not running', () => {
    expect(document.getElementById('pomodoroStartBtn').textContent).toContain('Start');
  });

  it('sets widget data-mode attribute correctly', () => {
    expect(document.getElementById('pomodoroWidget').dataset.mode).toBe('work');
    app.switchPomMode();
    expect(document.getElementById('pomodoroWidget').dataset.mode).toBe('break');
  });

  it('pads single-digit seconds with a leading zero', () => {
    // Force remaining to e.g. 5 seconds (0:05)
    app.resetPomodoro();
    // Manually set remaining via getPomState reference
    app.getPomState().remaining = 5;
    app.renderPomodoro();
    expect(document.getElementById('pomodoroTime').textContent).toBe('00:05');
  });
});

// ---------------------------------------------------------------------------
// togglePomodoro
// ---------------------------------------------------------------------------
describe('togglePomodoro', () => {
  beforeEach(() => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 25 } });
    app.resetPomodoro();
  });

  it('sets running to true when starting', () => {
    app.togglePomodoro();
    expect(app.getPomState().running).toBe(true);
  });

  it('sets running to false when pausing', () => {
    app.togglePomodoro(); // start
    app.togglePomodoro(); // pause
    expect(app.getPomState().running).toBe(false);
  });

  it('decrements remaining by 1 each second while running', () => {
    app.togglePomodoro(); // start
    const before = app.getPomState().remaining;
    jest.advanceTimersByTime(3000); // 3 seconds
    expect(app.getPomState().remaining).toBe(before - 3);
  });

  it('stops the timer automatically when remaining reaches 0', () => {
    // Set a very short work time (2 seconds)
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 1, pomodoroBreak: 1 } });
    app.resetPomodoro();
    app.getPomState().remaining = 2;
    app.togglePomodoro();
    jest.advanceTimersByTime(2000);
    expect(app.getPomState().running).toBe(false);
  });

  it('increments cycles when a work phase completes', () => {
    app.setState({ settings: { ...app.DEFAULT_SETTINGS, pomodoroWork: 1, pomodoroBreak: 1 } });
    app.resetPomodoro();
    app.getPomState().remaining = 1;
    app.togglePomodoro();
    jest.advanceTimersByTime(1000);
    expect(app.getPomState().cycles).toBe(1);
  });
});
