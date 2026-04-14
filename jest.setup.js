'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Read index.html once and extract <body> content for DOM reset in each test
// ---------------------------------------------------------------------------
const indexHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');

function extractBodyContent(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : '';
}

const BODY_CONTENT = extractBodyContent(indexHtml);

// ---------------------------------------------------------------------------
// Canvas 2D mock (jsdom does not implement it)
// ---------------------------------------------------------------------------
function makeFakeCtx() {
  return {
    clearRect:  jest.fn(),
    beginPath:  jest.fn(),
    closePath:  jest.fn(),
    fill:       jest.fn(),
    fillText:   jest.fn(),
    moveTo:     jest.fn(),
    lineTo:     jest.fn(),
    arcTo:      jest.fn(),
    roundRect:  jest.fn(),
    fillStyle:  '',
    font:       '',
    textAlign:  '',
  };
}

// ---------------------------------------------------------------------------
// Blob / URL mocks (used by export buttons)
// ---------------------------------------------------------------------------
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// ---------------------------------------------------------------------------
// Notification API mock
// ---------------------------------------------------------------------------
class MockNotification {
  constructor() {}
}
MockNotification.permission = 'denied';
MockNotification.requestPermission = jest.fn().mockResolvedValue('denied');
global.Notification = MockNotification;

// ---------------------------------------------------------------------------
// Per-test reset: fresh DOM, fresh module registry, clean storage
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Clear the Jest module registry so app.js re-executes for every test
  jest.resetModules();

  // Restore fresh DOM from index.html body
  document.body.innerHTML = BODY_CONTENT;
  document.body.dataset.theme = 'light';

  // Clean Web Storage
  localStorage.clear();
  sessionStorage.clear();

  // Reset all mocks (call counts etc.)
  jest.clearAllMocks();

  // Re-set canvas mock after clearAllMocks
  HTMLCanvasElement.prototype.getContext = jest.fn(makeFakeCtx);

  // Re-set URL mocks
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = jest.fn();

  // Dialog stubs – return safe defaults; individual tests can override
  global.confirm = jest.fn(() => false);
  global.alert   = jest.fn();
});
