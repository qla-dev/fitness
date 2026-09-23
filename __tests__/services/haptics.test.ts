import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  fireRefreshHaptic,
  fireSuccessHaptic,
} from '../../src/services/haptics';
import {
  useAppPreferencesStore,
  __resetAppPreferencesStoreForTests,
} from '../../src/stores/appPreferencesStore';

describe('haptics service', () => {
  const mockNotificationAsync =
    Haptics.notificationAsync as jest.MockedFunction<
      typeof Haptics.notificationAsync
    >;

  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetAppPreferencesStoreForTests();
    mockNotificationAsync.mockClear();
  });

  it('fires success haptics', () => {
    fireSuccessHaptic();

    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  it('does not fire when haptics are disabled', () => {
    useAppPreferencesStore.getState().setHapticsEnabled(false);

    fireSuccessHaptic();

    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  it('swallows success haptic rejections', () => {
    mockNotificationAsync.mockRejectedValueOnce(new Error('boom'));

    expect(() => fireSuccessHaptic()).not.toThrow();
  });

  describe('pull-to-refresh', () => {
    const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
      typeof Haptics.impactAsync
    >;

    beforeEach(() => mockImpactAsync.mockClear());

    it('taps lightly when a pull commits', () => {
      // An impact, not a success notification: this fires when the pull is
      // let go, before anything has been fetched, so there is nothing yet to
      // have succeeded.
      fireRefreshHaptic();

      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it('does not fire when haptics are disabled', () => {
      useAppPreferencesStore.getState().setHapticsEnabled(false);

      fireRefreshHaptic();

      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('swallows rejections', () => {
      mockImpactAsync.mockRejectedValueOnce(new Error('boom'));

      expect(() => fireRefreshHaptic()).not.toThrow();
    });
  });
});
