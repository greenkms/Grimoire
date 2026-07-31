import { mapGrimoireModeToQwen, mapQwenModeToGrimoire } from '@/providers/qwen/modes';

describe('Qwen ACP mode mapping', () => {
  it('maps Grimoire modes to Qwen ACP modes', () => {
    expect(mapGrimoireModeToQwen('normal')).toBe('default');
    expect(mapGrimoireModeToQwen('full_access')).toBe('yolo');
    expect(mapGrimoireModeToQwen('plan')).toBe('plan');
  });

  it('normalizes Qwen auto modes to Grimoire normal', () => {
    expect(mapQwenModeToGrimoire('auto-edit')).toBe('normal');
    expect(mapQwenModeToGrimoire('auto')).toBe('normal');
  });
});
