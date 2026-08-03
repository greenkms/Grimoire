import {
  sameDiscoveredModels,
  sameModes,
  sameStringList,
  sameStringMap,
  sameThinkingOptionsByModel,
} from '@/utils/collections';

describe('collection comparisons', () => {
  it('compares ordered lists and keyed maps structurally', () => {
    expect(sameStringList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameStringList(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameStringMap({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true);
    expect(sameStringMap({ a: '1' }, { a: '2' })).toBe(false);
  });

  it('normalizes absent optional descriptions while preserving order', () => {
    expect(sameModes(
      [{ id: 'plan', name: 'Plan' }],
      [{ id: 'plan', name: 'Plan', description: '' }],
    )).toBe(true);
    expect(sameDiscoveredModels(
      [{ rawId: 'model', label: 'Model' }],
      [{ rawId: 'model', label: 'Renamed' }],
    )).toBe(false);
  });

  it('compares per-model thinking options by key and order', () => {
    const left = {
      model: [{ value: 'high', label: 'High' }],
    };
    expect(sameThinkingOptionsByModel(left, {
      model: [{ value: 'high', label: 'High', description: '' }],
    })).toBe(true);
    expect(sameThinkingOptionsByModel(left, {
      model: [{ value: 'low', label: 'Low' }],
    })).toBe(false);
  });
});
