type TestWindow = typeof globalThis & {
  cancelAnimationFrame?: (handle: number) => void;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
};

const nodeTimers = require('node:timers') as typeof import('node:timers');
const testWindow = globalThis as TestWindow;

function ensureGlobalTimers(): void {
  const timerEntries = {
    clearInterval: nodeTimers.clearInterval,
    clearTimeout: nodeTimers.clearTimeout,
    setInterval: nodeTimers.setInterval,
    setTimeout: nodeTimers.setTimeout,
  } as const;

  for (const [name, fallback] of Object.entries(timerEntries)) {
    const key = name as keyof typeof timerEntries;
    if (typeof globalThis[key] !== 'function') {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: fallback,
        writable: true,
      });
    }
  }
}

ensureGlobalTimers();

if (!testWindow.requestAnimationFrame) {
  testWindow.requestAnimationFrame = (callback: FrameRequestCallback): number => (
    Number(setTimeout(() => callback(Date.now()), 0))
  );
}

if (!testWindow.cancelAnimationFrame) {
  testWindow.cancelAnimationFrame = (handle: number): void => {
    clearTimeout(handle);
  };
}

if (!('window' in globalThis)) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: testWindow,
    writable: true,
  });
}

beforeEach(() => {
  ensureGlobalTimers();
});

afterEach(() => {
  ensureGlobalTimers();
});
