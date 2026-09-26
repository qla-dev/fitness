import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkoutPhotos from '../../src/components/recording/WorkoutPhotos';
import { localApiFetch } from '../../src/services/local/localApi';
import { pickImagesFromLibrary } from '../../src/utils/pickImage';

jest.mock('../../src/services/local/localApi', () => ({
  localApiFetch: jest.fn(async () => []),
}));
jest.mock('../../src/utils/pickImage', () => ({
  pickImagesFromLibrary: jest.fn(async () => [{ uri: 'picked.jpg' }]),
  pickImageFromCamera: jest.fn(),
}));
jest.mock(
  '../../src/components/recording/WorkoutPhotoEditor',
  () =>
    ({ photo }: any) => {
      const { Text } = require('react-native');
      return <Text>{photo.fileName}</Text>;
    }
);
jest.mock('../../src/services/recording/photos', () => ({
  createRecordingPhoto: jest.fn(async () => ({
    fileName: 'aaaa.jpg',
    originalFileName: 'bbbb.jpg',
    capturedAt: 0,
  })),
  deleteRecordingPhoto: jest.fn(),
  recordingPhotoUri: () => 'file:///aaaa.jpg',
}));
jest.mock('@expo/ui/community/menu', () => ({
  MenuView: ({ children, onPressAction }: any) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable
        testID="photo-picker"
        onPress={() => onPressAction({ nativeEvent: { event: 'library' } })}
      >
        {children}
      </Pressable>
    );
  },
}));

it('keeps the empty section, saves a library pick, opens preview and keeps the add tile', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <WorkoutPhotos
        details={[]}
        sessionId="individual:1"
        composition={{
          width: 1080,
          height: 1920,
          top: 0,
          metrics: [],
          route: [],
        }}
      />
    </QueryClientProvider>
  );
  expect(view.getByText('Workout photos')).toBeTruthy();
  await waitFor(() => expect(localApiFetch).toHaveBeenCalled());
  fireEvent.press(view.getByTestId('photo-picker'));
  await waitFor(() => expect(view.getByText('aaaa.jpg')).toBeTruthy());
  expect(pickImagesFromLibrary).toHaveBeenCalledWith(1);
  expect(localApiFetch).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'POST',
      endpoint: '/api/workout-photos/individual%3A1',
    })
  );
  expect(view.getByTestId('photo-picker')).toBeTruthy();
  view.unmount();
  client.clear();
});
