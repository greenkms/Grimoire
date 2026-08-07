import {
  VaultSkillCommandCatalog,
  type VaultSkillStorageAdapter,
} from '../../../core/providers/commands/VaultSkillCommandCatalog';

export class OpencodeCommandCatalog extends VaultSkillCommandCatalog {
  constructor(adapter?: VaultSkillStorageAdapter) {
    super(adapter, {
      providerId: 'opencode',
      roots: [
        { id: 'opencode', path: '.opencode/skills', editable: true },
        { id: 'agents', path: '.agents/skills', editable: true },
        { id: 'claude', path: '.claude/skills', editable: false },
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
