import { dumpYamlFrontmatter, loadYamlFrontmatter } from '@/utils/yamlFrontmatter';

describe('yamlFrontmatter', () => {
  it('round-trips simple frontmatter objects without anchors', () => {
    const source = {
      name: 'research',
      description: 'Look things up',
      tools: ['read', 'search'],
    };

    const dumped = dumpYamlFrontmatter(source);
    expect(dumped).toContain('name: research');
    expect(dumped).not.toContain('&');
    expect(dumped).not.toContain('*');

    expect(loadYamlFrontmatter(dumped)).toEqual(source);
  });

  it('parses YAML maps into plain objects', () => {
    const parsed = loadYamlFrontmatter('name: demo\nenabled: true\n');
    expect(parsed).toEqual({ name: 'demo', enabled: true });
  });
});
