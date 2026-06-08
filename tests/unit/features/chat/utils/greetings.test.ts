import { getGreetingPool, getRandomGreeting } from '@/features/chat/utils/greetings';
import { setLocale } from '@/i18n/i18n';

describe('chat greetings', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('uses localized greeting copy', () => {
    setLocale('ru');

    const greetings = getGreetingPool({ day: 2, hour: 14 });

    expect(greetings).toContain('Заметки принесли доказательства.');
  });

  it('interpolates the configured user name through localized templates', () => {
    setLocale('ru');

    const greeting = getRandomGreeting({
      day: 2,
      hour: 14,
      name: 'Misha',
      random: () => 0,
    });

    expect(greeting).toBe('Счастливого вторника, Misha');
  });
});
