import {
  VaultSkillCommandCatalog,
  type VaultSkillStorageAdapter,
} from '../../../core/providers/commands/VaultSkillCommandCatalog';

export class KimicodeCommandCatalog extends VaultSkillCommandCatalog {
  constructor(adapter?: VaultSkillStorageAdapter) {
    super(adapter, {
      providerId: 'kimicode',
      roots: [
        { id: 'kimicode', path: '.kimi-code/skills', editable: true, includeFlatFiles: true },
        { id: 'agents', path: '.agents/skills', editable: true, includeFlatFiles: true },
      ],
      dropdown: {
        triggerChars: ['/'],
        builtInPrefix: '/',
        skillPrefix: '/skill:',
        commandPrefix: '/',
      },
    });
  }
}
