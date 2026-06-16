import {
  parseGrokCreditsConfigMessage,
} from '@/providers/grok/app/GrokBillingFetcher';

const SAMPLE_MESSAGE = Uint8Array.from(Buffer.from(
  '0a380dae47b94012001a002206088097f3d0062a060880b191d2063a07080215ae47b940421208011206088097f3d0061a060880b191d2066200',
  'hex',
));

describe('GrokBillingFetcher', () => {
  it('parses SuperGrok credit usage from billing protobuf payloads', () => {
    expect(parseGrokCreditsConfigMessage(SAMPLE_MESSAGE)).toEqual({
      plan: 'SuperGrok',
      note: expect.stringContaining('Free credits'),
      windows: [{
        label: 'Credits',
        pct: 6,
        pctKnown: true,
        reset: expect.stringMatching(/Jul/),
      }],
    });
  });
});