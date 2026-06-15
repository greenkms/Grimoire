import { buildGrokAgentProcessArgs } from '@/providers/grok/runtime/GrokLaunchArgs';

describe('GrokLaunchArgs', () => {
  it('launches stdio without reasoning effort when unset', () => {
    expect(buildGrokAgentProcessArgs(null)).toEqual(['agent', 'stdio']);
    expect(buildGrokAgentProcessArgs('default')).toEqual(['agent', 'stdio']);
  });

  it('passes --reasoning-effort before stdio for native launch-time effort', () => {
    expect(buildGrokAgentProcessArgs('high')).toEqual([
      'agent',
      '--reasoning-effort',
      'high',
      'stdio',
    ]);
  });
});