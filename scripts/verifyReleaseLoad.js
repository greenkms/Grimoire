const { copyFileSync, mkdtempSync, rmSync } = require('fs');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const { tmpdir } = require('os');
const path = require('path');
const { JSDOM } = require('jsdom');

class Scope {
  constructor(parent) {
    this.parent = parent;
  }

  register() {
    return {};
  }

  unregister() {}
}

class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest ?? { id: 'grimoire', version: 'test' };
    this._registeredViews = new Map();
  }

  addCommand() {}
  addRibbonIcon() {}
  addSettingTab() {}
  registerEvent(eventRef) {
    return eventRef;
  }
  registerDomEvent(element, eventName, handler, options) {
    element.addEventListener(eventName, handler, options);
  }
  registerView(viewType, factory) {
    this._registeredViews.set(viewType, factory);
  }
  async loadData() {
    return {};
  }
  async saveData() {}
}
class PluginSettingTab {}
class Modal {}
class Notice {}
class Setting {}
class TFile {}
class TFolder {}
class MarkdownView {}
class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = leaf.app.document.createElement('div');
    this.contentEl = this.containerEl.createDiv({ cls: 'view-content' });
  }

  load() {}
  registerEvent(eventRef) {
    return eventRef;
  }
  registerDomEvent(element, eventName, handler, options) {
    element.addEventListener(eventName, handler, options);
  }
}
class WorkspaceLeaf {}
class Menu {}
class Component {}

const obsidianStub = {
  Component,
  ItemView,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Platform: { isMacOS: false },
  Plugin,
  PluginSettingTab,
  Scope,
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
  addIcon: () => undefined,
  normalizePath: (value) => value,
  requestUrl: async () => ({}),
  setIcon: () => undefined,
};

class CodeMirrorRangeSetBuilder {
  add() {}
  finish() {
    return {
      map: () => this.finish(),
    };
  }
}

const codeMirrorStateStub = {
  RangeSetBuilder: CodeMirrorRangeSetBuilder,
  StateEffect: {
    appendConfig: {
      of: (value) => ({ value }),
    },
    define: () => {
      const effect = {
        of: (value) => ({ value, is: (candidate) => candidate === effect }),
      };
      return effect;
    },
  },
  StateField: {
    define: (spec) => spec,
  },
};

class CodeMirrorWidgetType {}

const codeMirrorDecorationNone = {
  map: () => codeMirrorDecorationNone,
};

function codeMirrorRangeDecoration() {
  return {
    range: () => ({}),
  };
}

const codeMirrorViewStub = {
  Decoration: {
    line: codeMirrorRangeDecoration,
    mark: codeMirrorRangeDecoration,
    none: codeMirrorDecorationNone,
    replace: codeMirrorRangeDecoration,
    set: () => codeMirrorDecorationNone,
    widget: codeMirrorRangeDecoration,
  },
  EditorView: {
    decorations: {
      from: (field) => field,
    },
  },
  WidgetType: CodeMirrorWidgetType,
};

function createChildProcessStub() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdin = {
    end: () => undefined,
    write: () => true,
  };
  child.kill = () => true;
  child.pid = 0;
  return child;
}

const childProcessStub = {
  execFile: (_file, _args, _options, callback) => {
    const child = createChildProcessStub();
    if (typeof callback === 'function') {
      callback(new Error('child_process is disabled in release smoke tests'), '', '');
    }
    return child;
  },
  execFileSync: () => {
    throw new Error('child_process is disabled in release smoke tests');
  },
  spawn: () => createChildProcessStub(),
};

function applyElementOptions(element, options = {}) {
  if (options.cls) {
    element.addClass(options.cls);
  }
  if (options.text != null) {
    element.textContent = options.text;
  }
  if (options.attr) {
    for (const [name, value] of Object.entries(options.attr)) {
      element.setAttribute(name, String(value));
    }
  }
}

function installObsidianDomExtensions(window) {
  const { HTMLElement } = window;
  const prototype = HTMLElement.prototype;

  prototype.addClass = function addClass(className) {
    this.classList.add(...String(className).split(/\s+/).filter(Boolean));
    return this;
  };
  prototype.removeClass = function removeClass(className) {
    this.classList.remove(...String(className).split(/\s+/).filter(Boolean));
    return this;
  };
  prototype.toggleClass = function toggleClass(className, enabled) {
    this.classList.toggle(className, enabled);
    return this;
  };
  prototype.hasClass = function hasClass(className) {
    return this.classList.contains(className);
  };
  prototype.empty = function empty() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
    return this;
  };
  prototype.setText = function setText(text) {
    this.textContent = text;
    return this;
  };
  prototype.appendText = function appendText(text) {
    this.appendChild(this.ownerDocument.createTextNode(text));
    return this;
  };
  prototype.setCssProps = function setCssProps(properties) {
    for (const [name, value] of Object.entries(properties)) {
      this.style.setProperty(name, String(value));
    }
    return this;
  };
  prototype.createDiv = function createDiv(options) {
    const element = this.ownerDocument.createElement('div');
    applyElementOptions(element, options);
    this.appendChild(element);
    return element;
  };
  prototype.createSpan = function createSpan(options) {
    const element = this.ownerDocument.createElement('span');
    applyElementOptions(element, options);
    this.appendChild(element);
    return element;
  };
  prototype.createEl = function createEl(tagName, options) {
    const element = this.ownerDocument.createElement(tagName);
    applyElementOptions(element, options);
    this.appendChild(element);
    return element;
  };
}

function createMemoryAdapter() {
  const files = new Map();
  return {
    exists: async (filePath) => files.has(filePath),
    list: async () => ({ files: [], folders: [] }),
    mkdir: async (filePath) => {
      files.set(filePath, '');
    },
    read: async (filePath) => files.get(filePath) ?? '',
    remove: async (filePath) => {
      files.delete(filePath);
    },
    rename: async (oldPath, newPath) => {
      files.set(newPath, files.get(oldPath) ?? '');
      files.delete(oldPath);
    },
    rmdir: async (filePath) => {
      files.delete(filePath);
    },
    stat: async () => null,
    write: async (filePath, content) => {
      files.set(filePath, content);
    },
  };
}

function createSmokeApp(window) {
  const adapter = createMemoryAdapter();
  const workspaceLeaves = [];
  const app = {
    document: window.document,
    scope: new Scope(),
    vault: {
      adapter,
      getAbstractFileByPath: () => null,
      getMarkdownFiles: () => [],
      offref: () => undefined,
      on: () => ({}),
    },
    workspace: {
      getActiveFile: () => null,
      getActiveViewOfType: () => null,
      getLeaf: () => ({ openFile: async () => undefined }),
      getLeavesOfType: (viewType) => workspaceLeaves.filter((leaf) => leaf.view?.getViewType?.() === viewType),
      getMostRecentLeaf: () => null,
      offref: () => undefined,
      on: () => ({}),
      revealLeaf: () => undefined,
      setActiveLeaf: () => undefined,
    },
  };
  return { app, workspaceLeaves };
}

function installDomGlobals(window) {
  const previous = new Map();
  const entries = {
    Element: window.Element,
    Event: window.Event,
    HTMLButtonElement: window.HTMLButtonElement,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
    Node: window.Node,
    document: window.document,
    window,
  };

  for (const [name, value] of Object.entries(entries)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value,
      writable: true,
    });
  }

  globalThis.createDiv = (options) => window.document.body.createDiv(options);
  globalThis.createEl = (tagName, options) => window.document.body.createEl(tagName, options);

  return () => {
    delete globalThis.createDiv;
    delete globalThis.createEl;
    for (const [name, descriptor] of previous.entries()) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    }
  };
}

async function withIsolatedReleaseBundle(bundlePath, callback) {
  const resolvedBundlePath = path.resolve(bundlePath);
  const tempDir = mkdtempSync(path.join(tmpdir(), 'grimoire-release-load-'));
  const isolatedBundlePath = path.join(tempDir, 'main.js');
  copyFileSync(resolvedBundlePath, isolatedBundlePath);

  const originalLoad = Module._load;
  Module._load = (request, parent, isMain) => {
    if (request === 'obsidian') {
      return obsidianStub;
    }
    if (request === '@codemirror/state') {
      return codeMirrorStateStub;
    }
    if (request === '@codemirror/view') {
      return codeMirrorViewStub;
    }
    if (request === 'electron') {
      return {};
    }
    if (request === 'child_process' || request === 'node:child_process') {
      return childProcessStub;
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    const loadedBundle = require(isolatedBundlePath);
    return await callback(loadedBundle, resolvedBundlePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[isolatedBundlePath];
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function verifyReleaseBundleLoads(bundlePath, { log = true } = {}) {
  const resolvedBundlePath = path.resolve(bundlePath);
  const tempDir = mkdtempSync(path.join(tmpdir(), 'grimoire-release-load-'));
  const isolatedBundlePath = path.join(tempDir, 'main.js');
  copyFileSync(resolvedBundlePath, isolatedBundlePath);

  const originalLoad = Module._load;
  Module._load = (request, parent, isMain) => {
    if (request === 'obsidian') {
      return obsidianStub;
    }
    if (request === '@codemirror/state') {
      return codeMirrorStateStub;
    }
    if (request === '@codemirror/view') {
      return codeMirrorViewStub;
    }
    if (request === 'electron') {
      return {};
    }
    if (request === 'child_process' || request === 'node:child_process') {
      return childProcessStub;
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    const loadedBundle = require(isolatedBundlePath);
    if (typeof loadedBundle.default !== 'function') {
      throw new Error('Release bundle did not export an Obsidian plugin class as default.');
    }
    if (log) {
      console.log(`Verified release bundle loads from isolated install dir: ${resolvedBundlePath}`);
    }
  } finally {
    Module._load = originalLoad;
    delete require.cache[isolatedBundlePath];
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function verifyReleaseBundleOpensView(bundlePath, { log = true } = {}) {
  return await withIsolatedReleaseBundle(bundlePath, async (loadedBundle, resolvedBundlePath) => {
    if (typeof loadedBundle.default !== 'function') {
      throw new Error('Release bundle did not export an Obsidian plugin class as default.');
    }

    const dom = new JSDOM('<!doctype html><body></body>');
    installObsidianDomExtensions(dom.window);
    const cleanupGlobals = installDomGlobals(dom.window);

    try {
      const { app, workspaceLeaves } = createSmokeApp(dom.window);
      const PluginClass = loadedBundle.default;
      const plugin = new PluginClass(app, { id: 'grimoire', version: 'smoke-test' });
      await plugin.onload();

      const viewFactory = plugin._registeredViews?.get('grimoire-view');
      if (typeof viewFactory !== 'function') {
        throw new Error('Release bundle did not register the grimoire-view view.');
      }

      const leaf = { app, view: null };
      const view = viewFactory(leaf);
      leaf.view = view;
      workspaceLeaves.push(leaf);

      if (!view || typeof view.onOpen !== 'function') {
        throw new Error('Registered grimoire-view did not create an openable view.');
      }

      await view.onOpen();

      const tabCount = view.contentEl.querySelectorAll('.grimoire-tab-content').length;
      if (tabCount < 1) {
        throw new Error('Opening grimoire-view did not create a chat tab.');
      }

      if (log) {
        console.log(`Verified release bundle opens grimoire-view: ${resolvedBundlePath}`);
      }

      return {
        tabCount,
        viewType: view.getViewType?.() ?? 'unknown',
      };
    } finally {
      cleanupGlobals();
      dom.window.close();
    }
  });
}

module.exports = {
  verifyReleaseBundleLoads,
  verifyReleaseBundleOpensView,
};
