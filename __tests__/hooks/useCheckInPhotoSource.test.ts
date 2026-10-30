import { renderHook } from '@testing-library/react-native';
import { useCheckInPhotoSource } from '../../src/hooks/useCheckInPhotoSource';

jest.mock('../../src/services/local/progressPhotoFiles', () => ({
  localProgressPhotoFile: (id: string) => ({
    uri: `file:///progress-photos/${id}.jpg`,
  }),
}));

test('progress photos resolve immediately to stable on-device sources', () => {
  const { result, rerender } = renderHook(() => useCheckInPhotoSource());
  expect(result.current.isReady).toBe(true);
  expect(result.current.getPhotoSource('')).toBeNull();
  const first = result.current.getPhotoSource('photo-1');
  expect(first).toEqual({
    uri: 'file:///progress-photos/photo-1.jpg',
    headers: {},
  });
  rerender({});
  expect(result.current.getPhotoSource('photo-1')).toBe(first);
  expect(result.current.getPhotoSource('photo-2')).not.toBe(first);
});
