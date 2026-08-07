import {
  VaultSkillCommandCatalog,
  type VaultSkillStorageAdapter,
} from '../../../core/providers/commands/VaultSkillCommandCatalog';

export class MimocodeCommandCatalog extends VaultSkillCommandCatalog {
  constructor(adapter?: VaultSkillStorageAdapter) {
    super(adapter, {
      providerId: 'mimocode',
      roots: [
        { id: 'mimocode', path: '.mimocode/skills', editable: true },
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
