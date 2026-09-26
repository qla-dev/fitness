import {
  calculateWorkoutRoute,
  searchRoutePlaces,
  NoDistinctReturnRouteError,
} from '../../../src/services/recording/routePlanner';

const start = { latitude: 43.85, longitude: 18.4 };
const destination = { latitude: 43.86, longitude: 18.42, name: 'Park' };
const response = {
  code: 'Ok',
  routes: [
    {
      distance: 2100,
      geometry: {
        coordinates: [
          [18.4, 43.85],
          [18.42, 43.86],
        ],
      },
    },
  ],
};
const originalFetch = global.fetch;
let request: jest.Mock;
beforeEach(() => {
  request = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => response } as Response);
  global.fetch = request;
});
afterEach(() => {
  global.fetch = originalFetch;
});

it('requests a walking round trip and preserves the selected destination', async () => {
  request.mockResolvedValueOnce({ ok: true, json: async () => response });
  request.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 'Ok',
      routes: [
        {
          distance: 2100,
          geometry: {
            coordinates: [
              [18.42, 43.86],
              [18.4, 43.85],
            ],
          },
        },
        {
          distance: 2600,
          geometry: {
            coordinates: [
              [18.42, 43.86],
              [18.43, 43.84],
              [18.4, 43.85],
            ],
          },
        },
      ],
    }),
  });
  const route = await calculateWorkoutRoute(
    start,
    destination,
    'run',
    true,
    new AbortController().signal
  );
  expect(request.mock.calls[0][0]).toContain(
    '/routed-foot/route/v1/foot/18.4,43.85;18.42,43.86?'
  );
  expect(route).toMatchObject({
    distance: 4700,
    destination: 'Park',
    roundTrip: true,
    destinationPoint: { latitude: 43.86, longitude: 18.42 },
  });
  expect(route.coordinates[0]).toEqual(start);
  expect(route.coordinates.at(-1)).toEqual(start);
  expect(route.coordinates).toContainEqual({
    latitude: 43.84,
    longitude: 18.43,
  });
  expect(request.mock.calls[1][0]).toContain('alternatives=true');
  expect(JSON.parse(JSON.stringify(route))).toEqual(route);
});

it('rejects a round trip when the provider only offers the same roads back', async () => {
  request.mockResolvedValueOnce({ ok: true, json: async () => response });
  request.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 'Ok',
      routes: [
        {
          distance: 2100,
          geometry: {
            coordinates: [
              [18.42, 43.86],
              [18.4, 43.85],
            ],
          },
        },
      ],
    }),
  });
  await expect(
    calculateWorkoutRoute(
      start,
      destination,
      'run',
      true,
      new AbortController().signal
    )
  ).rejects.toBeInstanceOf(NoDistinctReturnRouteError);
});

it('requests a cycling one-way route without adding the starting point again', async () => {
  await calculateWorkoutRoute(
    start,
    destination,
    'ride',
    false,
    new AbortController().signal
  );
  expect(request.mock.calls[0][0]).toContain(
    '/routed-bike/route/v1/bike/18.4,43.85;18.42,43.86?'
  );
});

it('rejects missing routes rather than inventing a straight-line route', async () => {
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ code: 'NoRoute', routes: [] }),
  });
  await expect(
    calculateWorkoutRoute(
      start,
      destination,
      'run',
      false,
      new AbortController().signal
    )
  ).rejects.toThrow();
});

it('caches submitted address searches and parses coordinates', async () => {
  request.mockResolvedValue({
    ok: true,
    json: async () => [{ lat: '43.86', lon: '18.42', display_name: 'Park' }],
  });
  const signal = new AbortController().signal;
  expect(await searchRoutePlaces('Park', 'en', signal)).toEqual([destination]);
  await searchRoutePlaces('Park', 'en', signal);
  expect(request).toHaveBeenCalledTimes(1);
});

it('does not send a cancelled route request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    calculateWorkoutRoute(start, destination, 'run', true, controller.signal)
  ).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
