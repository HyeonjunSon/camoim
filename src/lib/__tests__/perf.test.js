jest.mock('../analytics', () => ({ track: jest.fn() }));
import { track } from '../analytics';
import { mark, reportColdStart, trackTiming, __resetPerfForTests } from '../perf';

beforeEach(() => {
  __resetPerfForTests();
  track.mockClear();
});

describe('perf — cold start', () => {
  it('reports each segment exactly once when entering through session restore', () => {
    mark('fonts_ready');
    mark('session_ready', { sessionSource: 'cache' });
    reportColdStart();
    reportColdStart(); // Duplicate calls are ignored
    expect(track).toHaveBeenCalledTimes(1);
    const [name, props] = track.mock.calls[0];
    expect(name).toBe('perf_cold_start');
    expect(props).toMatchObject({ sessionSource: 'cache' });
    expect(props).toHaveProperty('fonts_ready');
    expect(props).toHaveProperty('first_content');
    expect(props.first_content).toBeGreaterThanOrEqual(props.fonts_ready);
  });

  it('the first value wins for a repeated mark', () => {
    mark('fonts_ready');
    const first = Date.now();
    mark('fonts_ready');
    mark('session_ready', { sessionSource: 'network' });
    reportColdStart();
    expect(track.mock.calls[0][1].fonts_ready).toBeLessThanOrEqual(first);
  });

  it('does not report when entering through the login screen (human input time included)', () => {
    mark('session_ready', { sessionSource: 'none' });
    reportColdStart();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('perf — trackTiming', () => {
  it('rounds ms to an integer before sending', () => {
    trackTiming('perf_chat_rtt', 151.6, { kind: 'dm' });
    expect(track).toHaveBeenCalledWith('perf_chat_rtt', { ms: 152, kind: 'dm' });
  });

  it('drops negatives and NaN (a clock stepping backwards, say)', () => {
    trackTiming('perf_feed_load', -5);
    trackTiming('perf_feed_load', NaN);
    expect(track).not.toHaveBeenCalled();
  });
});
