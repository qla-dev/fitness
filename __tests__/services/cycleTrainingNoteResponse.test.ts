import type * as Notifications from 'expo-notifications';

const mockGetLast = jest.fn<Notifications.NotificationResponse | null, []>(
  () => null
);
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getLastNotificationResponse: () => mockGetLast(),
  clearLastNotificationResponse: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockState = { routes: [{ name: 'Tabs' }] };
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  navigationRef: {
    isReady: () => true,
    getRootState: () => mockState,
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

let mockListener:
  ((response: Notifications.NotificationResponse) => void) | null = null;
jest.mock('../../src/services/notifications', () => ({
  addNotificationResponseListener: (
    listener: (response: Notifications.NotificationResponse) => void
  ) => {
    mockListener = listener;
    return { remove: jest.fn() };
  },
}));

jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

// English fallbacks with their placeholders filled, as the app shows them.
jest.mock('../../src/localization/i18n', () => ({
  __esModule: true,
  default: {
    t: (_key: string, options: Record<string, string>) =>
      options.defaultValue.replace(
        /\{\{(\w+)\}\}/g,
        (_match, name: string) => options[name] ?? ''
      ),
  },
}));

const response = (
  data: Record<string, unknown>,
  identifier = 'cycle_training_2026-11-05',
  actionIdentifier = 'expo.modules.notifications.actions.DEFAULT'
) =>
  ({
    actionIdentifier,
    notification: {
      request: {
        identifier,
        content: { title: 'Easy day', body: 'Keep it light.', data },
      },
    },
  }) as unknown as Notifications.NotificationResponse;

describe('cycle training note taps', () => {
  beforeEach(() => {
    jest.resetModules();
    mockNavigate.mockClear();
    mockListener = null;
    mockGetLast.mockReset();
    mockGetLast.mockReturnValue(null);
  });

  const init = () =>
    require('../../src/services/cycleTrainingNoteResponse').initCycleTrainingNoteResponses();

  it("opens MarkAI with the note as MarkAI's first message", () => {
    init();
    mockListener?.(response({ cycleTrainingNote: true, date: '2026-11-05' }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [route, params] = mockNavigate.mock.calls[0];
    expect(route).toBe('MarkAI');
    expect(params.preset).toEqual({
      prompt: '',
      opener:
        'Easy day\n\nKeep it light.\n\nWould you like more information or recommendations for today?',
      mode: 'training',
    });
  });

  it('ignores other notifications and opens one tap only once', () => {
    init();
    mockListener?.(response({ medicationId: 'm1' }, 'med'));
    expect(mockNavigate).not.toHaveBeenCalled();

    const tap = response({ cycleTrainingNote: true });
    mockListener?.(tap);
    mockListener?.(tap);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('opens the note that launched the app', () => {
    mockGetLast.mockReturnValue(response({ cycleTrainingNote: true }));
    init();
    expect(mockNavigate).toHaveBeenCalledWith(
      'MarkAI',
      expect.objectContaining({ preset: expect.any(Object) })
    );
  });
});
