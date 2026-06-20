export const CHANGELOG_CATEGORY_TITLES = ['Added', 'Improved', 'Fixed'] as const;

export type ChangelogCategoryTitle = (typeof CHANGELOG_CATEGORY_TITLES)[number];

export interface ChangelogCategory {
  title: ChangelogCategoryTitle;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date?: string;
  categories: ChangelogCategory[];
}
