import {
  CHANGELOG_CATEGORY_TITLES,
  type ChangelogCategory,
  type ChangelogCategoryTitle,
  type ChangelogRelease,
} from './types';

const RELEASE_HEADING_PATTERN = /^##\s+(\d+\.\d+\.\d+)(?:\s+-\s+(.+))?\s*$/;
const CATEGORY_HEADING_PATTERN = /^###\s+(.+?)\s*$/;
const BULLET_PATTERN = /^-\s+(.+?)\s*$/;

function isSupportedCategoryTitle(title: string): title is ChangelogCategoryTitle {
  return (CHANGELOG_CATEGORY_TITLES as readonly string[]).includes(title);
}

export function parseChangelogRelease(markdown: string, version: string): ChangelogRelease | null {
  const lines = markdown.split(/\r?\n/);
  let releaseStartIndex = -1;
  let date: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const match = RELEASE_HEADING_PATTERN.exec(lines[index]);
    if (match?.[1] === version) {
      releaseStartIndex = index;
      date = match[2];
      break;
    }
  }

  if (releaseStartIndex === -1) {
    return null;
  }

  const itemsByCategory = new Map<ChangelogCategoryTitle, string[]>();
  let currentCategory: ChangelogCategoryTitle | null = null;

  for (let index = releaseStartIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (RELEASE_HEADING_PATTERN.test(line)) {
      break;
    }

    const categoryMatch = CATEGORY_HEADING_PATTERN.exec(line);
    if (categoryMatch) {
      currentCategory = isSupportedCategoryTitle(categoryMatch[1]) ? categoryMatch[1] : null;
      continue;
    }

    if (!currentCategory) {
      continue;
    }

    const bulletMatch = BULLET_PATTERN.exec(line);
    if (!bulletMatch) {
      continue;
    }

    const items = itemsByCategory.get(currentCategory) ?? [];
    items.push(bulletMatch[1]);
    itemsByCategory.set(currentCategory, items);
  }

  const categories: ChangelogCategory[] = CHANGELOG_CATEGORY_TITLES.flatMap(title => {
    const items = itemsByCategory.get(title) ?? [];
    return items.length > 0 ? [{ title, items }] : [];
  });

  if (categories.length === 0) {
    return null;
  }

  return {
    version,
    ...(date ? { date } : {}),
    categories,
  };
}
