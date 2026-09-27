import React from 'react';
import { act, render } from '@testing-library/react-native';
import PhotoEditorCanvas from '../../src/components/recording/PhotoEditorCanvas';
import {
  defaultPhotoEditorOptions,
  identityPhotoTransform,
} from '../../src/services/recording/photoEditor';

type Touch = { id: number; x: number; y: number };
type Event = { allTouches: Touch[]; changedTouches: Touch[] };
const mockHandlers: Record<string, (event: Event, manager: unknown) => void> =
  {};
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Manual: () => {
      const builder: Record<string, unknown> = {};
      for (const name of [
        'enabled',
        'onTouchesDown',
        'onTouchesMove',
        'onTouchesUp',
        'onTouchesCancelled',
        'onFinalize',
      ]) {
        builder[name] = (value: unknown) => {
          if (typeof value === 'function')
            mockHandlers[name] = value as (typeof mockHandlers)[string];
          return builder;
        };
      }
      return builder;
    },
  },
}));

const composition = {
  width: 360,
  height: 720,
  top: 90,
  metrics: [{ text: '5 km', x: 24, y: 90, size: 48 }],
  route: [
    { latitude: 43, longitude: 18, segment: 0 },
    { latitude: 44, longitude: 19, segment: 0 },
  ],
};
const manager = { activate: jest.fn(), fail: jest.fn(), end: jest.fn() };
function touch(name: string, allTouches: Touch[], changedTouches = allTouches) {
  act(() => mockHandlers[name]({ allTouches, changedTouches }, manager));
}
function setup() {
  const commit = jest.fn();
  const busy = jest.fn();
  render(
    <PhotoEditorCanvas
      layers={{ background: 'background', stats: 'stats', route: 'route' }}
      composition={composition}
      options={{ ...defaultPhotoEditorOptions, aspectRatio: 0.5 }}
      width={400}
      height={800}
      disabled={false}
      onCommit={commit}
      onBusy={busy}
    />
  );
  return { commit, busy };
}

it('drags the stats without changing the route', () => {
  const { commit, busy } = setup();
  touch('onTouchesDown', [{ id: 1, x: 20, y: 110 }]);
  touch('onTouchesMove', [{ id: 1, x: 60, y: 190 }]);
  touch('onTouchesUp', []);
  touch('onFinalize', []);
  expect(commit).toHaveBeenCalledWith(
    { x: 0.1, y: 0.1, scale: 1, rotation: 0 },
    identityPhotoTransform
  );
  expect(busy.mock.calls).toEqual([[true], [false]]);
});

it('pinches and rotates the route independently, without a jump when a finger lifts', () => {
  const { commit } = setup();
  touch('onTouchesDown', [
    { id: 1, x: 268, y: 608 },
    { id: 2, x: 308, y: 608 },
  ]);
  touch('onTouchesMove', [
    { id: 1, x: 288, y: 568 },
    { id: 2, x: 288, y: 648 },
  ]);
  touch(
    'onTouchesUp',
    [{ id: 1, x: 288, y: 568 }],
    [{ id: 2, x: 288, y: 648 }]
  );
  touch('onTouchesMove', [{ id: 1, x: 298, y: 588 }]);
  touch('onTouchesUp', []);
  touch('onFinalize', []);
  const [stats, route] = commit.mock.calls[0];
  expect(stats).toEqual(identityPhotoTransform);
  expect(route.scale).toBe(2);
  expect(route.rotation).toBeCloseTo(Math.PI / 2);
  expect(route.x).toBeCloseTo(1.285);
  expect(route.y).toBeCloseTo(0.065);
});
