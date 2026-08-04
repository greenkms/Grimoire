import { createMockEl } from '@test/helpers/mockElement';

import {
  buildPermissionCommandSummary,
  InlinePermissionRequest,
} from '@/features/chat/rendering/InlinePermissionRequest';

describe('InlinePermissionRequest', () => {
  it('keeps a verbose execute title out of the header layout', () => {
    const parentEl = createMockEl();
    const resolve = jest.fn();
    const command = 'python3 .grimoire/generate_data.py 2>&1 | tail -5 && wc -l vault-data.js';
    const request = new InlinePermissionRequest(parentEl, {
      toolName: `Execute \`${command}\``,
      input: { command },
      description: `Execute: ${command}`,
      decisionOptions: [{ decision: 'allow', label: 'Allow once', value: 'allow' }],
      resolve,
    });

    request.render();

    expect(parentEl.querySelector('.grimoire-permission-tool-label')?.textContent)
      .toBe('python3 · generate_data.py');
    expect(parentEl.querySelector('.grimoire-permission-subtitle')?.textContent)
      .toBe('Grimoire wants to run a shell command');
    expect(parentEl.querySelector('.grimoire-permission-command-code')?.textContent).toBe(command);
    expect(parentEl.querySelector('.grimoire-permission-description')).toBeNull();
    const dialog = parentEl.querySelector('.grimoire-permission-request');
    const title = parentEl.querySelector('.grimoire-permission-title');
    expect(dialog?.getAttribute('aria-label')).toBeNull();
    expect(dialog?.getAttribute('aria-labelledby')).toBe(title?.getAttribute('id'));
    parentEl.querySelector('.grimoire-permission-button--allow')?.click();
    expect(resolve).toHaveBeenCalledWith('allow');
  });

  it('summarizes long path lists by their meaningful final segments', () => {
    const command = [
      'ls /Users/test/ExampleVault/Climate',
      '/Users/test/ExampleVault/Phenomena',
      '/Users/test/ExampleVault/Threats',
    ].join('\n');

    expect(buildPermissionCommandSummary(command)).toBe('ls · Climate, Phenomena +1');

    const parentEl = createMockEl();
    const request = new InlinePermissionRequest(parentEl, {
      toolName: 'Ls /users/test/example-vault…',
      input: { command },
      description: `OpenCode wants permission to use ${command}.`,
      decisionOptions: [{ decision: 'allow', label: 'Allow once', value: 'allow' }],
      resolve: jest.fn(),
    });
    request.render();

    expect(parentEl.querySelector('.grimoire-permission-tool-label')?.textContent)
      .toBe('ls · Climate, Phenomena +1');
    expect(parentEl.querySelector('.grimoire-permission-tool')?.getAttribute('title')).toBe(command);
    expect(parentEl.querySelector('.grimoire-permission-subtitle')?.textContent)
      .toBe('Grimoire wants to run a shell command');
    expect(parentEl.querySelector('.grimoire-permission-description')?.textContent)
      .toBe('OpenCode requested permission to run this command.');
    request.destroy();
  });

  it('bounds unknown tool labels so they cannot expand the header', () => {
    const parentEl = createMockEl();
    const request = new InlinePermissionRequest(parentEl, {
      toolName: 'An unknown provider tool with a very long generated display label',
      input: {},
      description: 'Permission requested.',
      decisionOptions: [{ decision: 'deny', label: 'Deny', value: 'deny' }],
      resolve: jest.fn(),
    });

    request.render();

    const label = parentEl.querySelector('.grimoire-permission-tool-label')?.textContent ?? '';
    expect(label).toHaveLength(28);
    expect(label.endsWith('…')).toBe(true);
    request.destroy();
  });
});
