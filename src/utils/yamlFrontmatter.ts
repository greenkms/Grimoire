/**
 * Shared YAML helpers for vault frontmatter (skills, agents, commands).
 * Uses the `yaml` package instead of `js-yaml` for Obsidian community review.
 */

import { parse, stringify } from 'yaml';

const DUMP_OPTIONS = {
  // Match previous js-yaml `lineWidth: -1` / unlimited wrap behavior.
  lineWidth: 0,
  // Match previous js-yaml `noRefs: true` (no anchors/aliases).
  aliasDuplicateObjects: false,
} as const;

export function dumpYamlFrontmatter(value: unknown): string {
  return stringify(value, DUMP_OPTIONS).trimEnd();
}

export function loadYamlFrontmatter(value: string): unknown {
  return parse(value);
}
