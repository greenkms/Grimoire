import {
  VaultSkillCommandCatalog,
  type VaultSkillStorageAdapter,
} from '../../../core/providers/commands/VaultSkillCommandCatalog';

export class GrokCommandCatalog extends VaultSkillCommandCatalog {
  constructor(adapter?: VaultSkillStorageAdapter) {
    super(adapter, {
      providerId: 'grok',
      roots: [
        { id: 'grok', path: '.grok/skills', editable: true },
        { id: 'agents', path: '.agents/skills', editable: true },
        { id: 'claude', path: '.claude/skills', editable: true },
        { id: 'cursor', path: '.cursor/skills', editable: false },
      ],
      dropdown: {
        triggerChars: ['/'],
        builtInPrefix: '/',
        skillPrefix: '/',
        commandPrefix: '/',
      },
    });
  }
}
