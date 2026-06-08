import { t } from '../../../i18n/i18n';
import type { TranslationKey } from '../../../i18n/types';

type GreetingInput = {
  day: number;
  hour: number;
  name?: string | null;
  random?: () => number;
};

type GreetingKey = `chat.greetings.${string}`;
type GreetingEntry = GreetingKey | {
  named?: GreetingKey;
  plain: GreetingKey;
};

function normalizeName(name?: string | null): string {
  return name?.trim() ?? '';
}

function translateGreeting(key: GreetingKey, name: string): string {
  return t(key as TranslationKey, name ? { name } : undefined);
}

function resolveGreeting(entry: GreetingEntry, name: string): string {
  if (typeof entry === 'string') {
    return translateGreeting(entry, name);
  }

  return translateGreeting(name && entry.named ? entry.named : entry.plain, name);
}

export function getGreetingPool(input: GreetingInput): string[] {
  const { day, hour } = input;
  const name = normalizeName(input.name);

  const dayGreetings: Record<number, GreetingEntry[]> = {
    0: [
      { plain: 'chat.greetings.day.sunday.plain', named: 'chat.greetings.day.sunday.named' },
      'chat.greetings.day.sundaySession',
      'chat.greetings.day.weekend',
    ],
    1: [
      { plain: 'chat.greetings.day.monday.plain', named: 'chat.greetings.day.monday.named' },
      { plain: 'chat.greetings.day.backAtIt.plain', named: 'chat.greetings.day.backAtIt.named' },
    ],
    2: [
      { plain: 'chat.greetings.day.tuesday.plain', named: 'chat.greetings.day.tuesday.named' },
    ],
    3: [
      { plain: 'chat.greetings.day.wednesday.plain', named: 'chat.greetings.day.wednesday.named' },
    ],
    4: [
      { plain: 'chat.greetings.day.thursday.plain', named: 'chat.greetings.day.thursday.named' },
    ],
    5: [
      { plain: 'chat.greetings.day.friday.plain', named: 'chat.greetings.day.friday.named' },
      { plain: 'chat.greetings.day.fridayFeeling.plain', named: 'chat.greetings.day.fridayFeeling.named' },
    ],
    6: [
      { plain: 'chat.greetings.day.saturday.plain', named: 'chat.greetings.day.saturday.named' },
      { plain: 'chat.greetings.day.weekend', named: 'chat.greetings.day.weekendNamed' },
    ],
  };

  const timeGreetings: GreetingEntry[] = (() => {
    if (hour >= 5 && hour < 12) {
      return [
        { plain: 'chat.greetings.time.morning.plain', named: 'chat.greetings.time.morning.named' },
        'chat.greetings.time.coffee',
        'chat.greetings.time.morningNotes',
        'chat.greetings.time.freshContext',
      ];
    }

    if (hour >= 12 && hour < 18) {
      return [
        { plain: 'chat.greetings.time.afternoon.plain', named: 'chat.greetings.time.afternoon.named' },
        { plain: 'chat.greetings.time.hey.plain', named: 'chat.greetings.time.hey.named' },
        { plain: 'chat.greetings.time.howsItGoing.plain', named: 'chat.greetings.time.howsItGoing.named' },
        'chat.greetings.time.afternoonContext',
      ];
    }

    if (hour >= 18 && hour < 22) {
      return [
        { plain: 'chat.greetings.time.evening.plain', named: 'chat.greetings.time.evening.named' },
        { plain: 'chat.greetings.time.eveningShort.plain', named: 'chat.greetings.time.eveningShort.named' },
        { plain: 'chat.greetings.time.howWasDay.plain', named: 'chat.greetings.time.howWasDay.named' },
        'chat.greetings.time.eveningEdits',
      ];
    }

    return [
      'chat.greetings.time.nightOwl',
      { plain: 'chat.greetings.time.eveningShort.plain', named: 'chat.greetings.time.eveningShort.named' },
      'chat.greetings.time.lateSession',
      'chat.greetings.time.vaultLateHours',
    ];
  })();

  const generalGreetings: GreetingEntry[] = [
    { plain: 'chat.greetings.general.hey.plain', named: 'chat.greetings.general.hey.named' },
    { plain: 'chat.greetings.general.hi.plain', named: 'chat.greetings.general.hi.named' },
    { plain: 'chat.greetings.general.howsItGoing.plain', named: 'chat.greetings.general.howsItGoing.named' },
    { plain: 'chat.greetings.general.welcomeBack.plain', named: 'chat.greetings.general.welcomeBack.named' },
    { plain: 'chat.greetings.general.whatsNew.plain', named: 'chat.greetings.general.whatsNew.named' },
    ...(name
      ? [
        'chat.greetings.general.returns' as GreetingEntry,
        'chat.greetings.general.readyNamed' as GreetingEntry,
      ]
      : []),
    'chat.greetings.general.right',
    'chat.greetings.general.ready',
    'chat.greetings.general.untangling',
    'chat.greetings.general.suspiciousPlan',
  ];

  const quips: GreetingEntry[] = [
    'chat.greetings.quips.vaultAwake',
    'chat.greetings.quips.notesReceipts',
    'chat.greetings.quips.askBoldly',
    'chat.greetings.quips.backlinks',
    'chat.greetings.quips.spell',
    'chat.greetings.quips.cleanDiff',
    'chat.greetings.quips.caffeinated',
    'chat.greetings.quips.noPressure',
    'chat.greetings.quips.summonContext',
    'chat.greetings.quips.earnKeep',
  ];

  return [
    ...(dayGreetings[day] || []),
    ...timeGreetings,
    ...generalGreetings,
    ...quips,
  ].map((entry) => resolveGreeting(entry, name));
}

export function getRandomGreeting(input: GreetingInput): string {
  const pool = getGreetingPool(input);
  const random = input.random ?? Math.random;
  return pool[Math.floor(random() * pool.length)] ?? 'Welcome back!';
}
