import { shouldShowWhatsNew } from '@/app/changelog/display';

describe('shouldShowWhatsNew', () => {
  it('shows when the user has never seen a changelog version', () => {
    expect(shouldShowWhatsNew({ currentVersion: '1.0.23', lastSeenVersion: '' })).toBe(true);
  });

  it('shows when the installed version is newer than the last seen version', () => {
    expect(shouldShowWhatsNew({ currentVersion: '1.0.23', lastSeenVersion: '1.0.22' })).toBe(true);
  });

  it('does not show when the current version has already been seen', () => {
    expect(shouldShowWhatsNew({ currentVersion: '1.0.23', lastSeenVersion: '1.0.23' })).toBe(false);
  });

  it('does not show for invalid current versions', () => {
    expect(shouldShowWhatsNew({ currentVersion: '', lastSeenVersion: '1.0.22' })).toBe(false);
    expect(shouldShowWhatsNew({ currentVersion: 'unknown', lastSeenVersion: '1.0.22' })).toBe(false);
  });
});
