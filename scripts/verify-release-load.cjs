#!/usr/bin/env node

const Module = require('node:module');
const path = require('node:path');

const bundlePath = path.resolve(process.argv[2] ?? 'dist/grimoire/main.js');
const originalLoad = Module._load;

class Plugin {}
class PluginSettingTab {}
class Modal {}
class Notice {}
class Setting {}
class TFile {}
class TFolder {}
class MarkdownView {}
class ItemView {}
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
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath: (value) => value,
  requestUrl: async () => ({}),
};

Module._load = (request, parent, isMain) => {
  if (request === 'obsidian') {
    return obsidianStub;
  }
  if (request === 'electron') {
    return {};
  }
  return originalLoad(request, parent, isMain);
};

try {
  const loadedBundle = require(bundlePath);
  if (typeof loadedBundle.default !== 'function') {
    throw new Error('Release bundle did not export an Obsidian plugin class as default.');
  }
  console.log(`Verified release bundle loads: ${bundlePath}`);
} finally {
  Module._load = originalLoad;
}
