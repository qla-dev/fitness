import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ProgressPhotosScreen from '../../src/screens/ProgressPhotosScreen';
import { useCheckInPhotoGallery } from '../../src/hooks/useCheckInPhotos';
import { useCheckInPhotoSource } from '../../src/hooks/useCheckInPhotoSource';
import { usePreferences } from '../../src/hooks/usePreferences';
import { useScreenHeader } from '../../src/hooks/useScreenHeader';
import type { ProgressPhotoDay } from '../../src/types/checkInPhotos';

// Recording a day moved to PhotoDayCapture on the tracker, so this screen no
// longer reads the day's photos, the picker or the mutations — it is the
// history and nothing else. Those behaviours are covered in
// __tests__/components/PhotoDayCapture.test.tsx.
jest.mock('../../src/hooks/useCheckInPhotos', () => ({
  useCheckInPhotoGallery: jest.fn(),
}));
jest.mock('../../src/hooks/useCheckInPhotoSource', () => ({
  useCheckInPhotoSource: jest.fn(),
}));
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: jest.fn(),
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: jest.fn(() => null),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockUseGallery = useCheckInPhotoGallery as jest.MockedFunction<
  typeof useCheckInPhotoGallery
>;
const mockUseSource = useCheckInPhotoSource as jest.MockedFunction<
  typeof useCheckInPhotoSource
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseScreenHeader = useScreenHeader as jest.MockedFunction<
  typeof useScreenHeader
>;
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { key: 'ProgressPhotos-key', name: 'ProgressPhotos' as const };

const dayWith = (
  entry_date: string,
  weight: number | null,
  angles: ('front' | 'back' | 'side')[] = ['front']
): ProgressPhotoDay => ({
  entry_date,
  weight,
  photos: Object.fromEntries(
    angles.map((angle) => [
      angle,
      { id: `${entry_date}-${angle}`, entry_date, photo_type: angle, weight },
    ])
  ),
});

const setGallery = (
  days: ProgressPhotoDay[],
  extra: { isLoading?: boolean; isError?: boolean } = {}
) => {
  mockUseGallery.mockReturnValue({
    days,
    isLoading: extra.isLoading ?? false,
    isError: extra.isError ?? false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useCheckInPhotoGallery>);
};

const renderScreen = () =>
  render(
    <ProgressPhotosScreen
      navigation={
        navigation as unknown as React.ComponentProps<
          typeof ProgressPhotosScreen
        >['navigation']
      }
      route={
        route as unknown as React.ComponentProps<
          typeof ProgressPhotosScreen
        >['route']
      }
    />
  );

describe('ProgressPhotosScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSource.mockReturnValue({
      getPhotoSource: jest.fn((id: string) => ({
        uri: `https://x/${id}`,
        headers: {},
      })),
      isReady: true,
    } as unknown as ReturnType<typeof useCheckInPhotoSource>);
    mockUsePreferences.mockReturnValue({
      preferences: { default_weight_unit: 'kg' },
    } as unknown as ReturnType<typeof usePreferences>);
    setGallery([dayWith('2026-03-20', 80), dayWith('2026-03-01', 84)]);
  });

  it('lists a row per day with that day’s weight', () => {
    const { getByText } = renderScreen();

    expect(getByText('80 kg')).toBeTruthy();
    expect(getByText('84 kg')).toBeTruthy();
  });

  it('shows the change against the previous shoot, not against the first', () => {
    // A pile of dated pictures is not progression; the delta is what makes the
    // list read as one.
    const { getByText } = renderScreen();

    expect(getByText('-4 kg since previous')).toBeTruthy();
  });

  it('shows only the selected angle and switches with the history control', () => {
    setGallery([
      dayWith('2026-03-20', 80, ['front']),
      dayWith('2026-03-01', 84, ['back']),
    ]);

    const { getByText, getByRole, queryByText } = renderScreen();

    // Front is the default, so only the front day has a row.
    expect(getByText('80 kg')).toBeTruthy();
    expect(queryByText('84 kg')).toBeNull();

    fireEvent.press(getByRole('tab', { name: 'Back' }));

    expect(getByText('84 kg')).toBeTruthy();
    expect(queryByText('80 kg')).toBeNull();
  });

  it('opens the comparison for the angle being viewed', () => {
    const { getByText } = renderScreen();

    fireEvent.press(getByText('Compare'));

    expect(navigation.navigate).toHaveBeenCalledWith('ProgressPhotoCompare', {
      angle: 'front',
    });
  });

  it('opens the time-lapse for the angle being viewed', () => {
    const { getByText } = renderScreen();

    fireEvent.press(getByText('Time-lapse'));

    expect(navigation.navigate).toHaveBeenCalledWith('ProgressPhotoTimelapse', {
      angle: 'front',
    });
  });

  it('leaves compare and time-lapse inert with a single shoot', () => {
    // Both need two photos of the angle to say anything.
    setGallery([dayWith('2026-03-20', 80)]);

    const { getByText } = renderScreen();

    fireEvent.press(getByText('Compare'));
    fireEvent.press(getByText('Time-lapse'));

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('keeps the header free of a capture action now the tracker owns adding', () => {
    renderScreen();

    const config = mockUseScreenHeader.mock.calls[0][0] as unknown as {
      right?: unknown;
    };

    expect(config.right).toBeUndefined();
  });

  it('prompts to add photos when the angle has none', () => {
    setGallery([]);

    const { getByText } = renderScreen();

    expect(getByText('No front photos yet')).toBeTruthy();
  });

  it('surfaces a load failure instead of an empty timeline', () => {
    setGallery([], { isError: true });

    const { getByText } = renderScreen();

    expect(getByText("Couldn't load your progress photos.")).toBeTruthy();
  });

  it('offers to log the weight on a day that has none', () => {
    // A photo taken before the day's weigh-in would otherwise read as missing
    // forever, since the only way back was Measurements.
    setGallery([dayWith('2026-03-20', null)]);

    const { getAllByText, queryByText } = renderScreen();

    // Once, on the timeline row for that day — the screen is the history now.
    expect(getAllByText('Log weight')).toHaveLength(1);
    expect(queryByText('No weight logged')).toBeNull();
  });

  it('opens weight entry for the row’s own day', () => {
    setGallery([dayWith('2026-03-20', null)]);

    const { getAllByText } = renderScreen();
    fireEvent.press(getAllByText('Log weight')[0]);

    expect(navigation.navigate).toHaveBeenCalledWith('MeasurementsAdd', {
      date: '2026-03-20',
    });
  });

  it('shows the weight plainly on a row that has one', () => {
    setGallery([dayWith('2026-03-20', 81)]);

    const { getAllByText } = renderScreen();

    expect(getAllByText('81 kg')).toHaveLength(1);
  });

  describe('the history preview', () => {
    /** `n` shoots, newest first, one kilo apart so every delta is -1 kg. */
    const shoots = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        dayWith(`2026-03-${String(28 - i).padStart(2, '0')}`, 100 + i)
      );

    it('lists only the seven most recent shoots', () => {
      setGallery(shoots(10));

      const { getByText, queryByText } = renderScreen();

      // Newest is 100 kg, so the seventh back is 106 and the eighth 107.
      expect(getByText('106 kg')).toBeTruthy();
      expect(queryByText('107 kg')).toBeNull();
    });

    it('still shows a delta on the oldest visible row', () => {
      // The shoot it compares against sits outside the preview, so this only
      // holds if the cut happens after the deltas are worked out.
      setGallery(shoots(10));

      const { getAllByText } = renderScreen();

      expect(getAllByText('-1 kg since previous')).toHaveLength(7);
    });

    it('carries no heading or blurb over the control', () => {
      // The screen's own title says what this is; a "History" heading under it
      // was the same word twice, and the line under that described a cap the
      // list already shows by ending.
      setGallery(shoots(10));

      const { queryByText } = renderScreen();

      expect(queryByText('History')).toBeNull();
      expect(queryByText(/most recent/)).toBeNull();
      expect(queryByText(/newest first/)).toBeNull();
    });

    it('keeps compare and time-lapse live on a long history', () => {
      // They are what a long history sends you to for anything older, so
      // gating them on the preview rather than the whole history would switch
      // them off for exactly the people who need them.
      setGallery(shoots(10));

      const { getByText } = renderScreen();
      fireEvent.press(getByText('Compare'));

      expect(navigation.navigate).toHaveBeenCalledWith('ProgressPhotoCompare', {
        angle: 'front',
      });
    });
  });

  it('carries no day slots of its own', () => {
    // The screen used to open on the same block the tracker already shows, so
    // reaching the picker meant tapping through to a second copy of what was
    // on screen. Recording lives on the day; this is only the looking back.
    setGallery([dayWith('2026-03-20', 80, ['front'])]);

    const { queryByLabelText } = renderScreen();

    expect(queryByLabelText('Add the front photo')).toBeNull();
    expect(queryByLabelText('Replace or remove the front photo')).toBeNull();
  });
});
