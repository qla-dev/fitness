import { z } from 'zod';
import type { PlannedRoute, RecordingSport } from './types';

export type RoutePoint = { latitude: number; longitude: number };
export type RoutePlace = RoutePoint & { name: string };
const coordinate = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const routeResponse = z.object({
  code: z.literal('Ok'),
  routes: z
    .array(
      z.object({
        distance: z.number().positive(),
        geometry: z.object({ coordinates: z.array(coordinate).min(2) }),
      })
    )
    .min(1),
});
const placesResponse = z.array(
  z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    display_name: z.string(),
  })
);

// Public OSM providers: explicit searches only, cached and limited to 1 request/s.
let nextRequest = 0;
const searches = new Map<string, RoutePlace[]>();
async function request(url: string, signal: AbortSignal): Promise<unknown> {
  const wait = Math.max(0, nextRequest - Date.now());
  nextRequest = Date.now() + wait + 1100;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  if (signal.aborted) throw new Error('Cancelled');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'qla.fit/1.0 (https://qla.fit)',
        Accept: 'application/json',
      },
    });
    if (!response.ok) throw new Error('Route provider unavailable');
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export async function searchRoutePlaces(
  query: string,
  language: string,
  signal: AbortSignal
): Promise<RoutePlace[]> {
  const key = `${language}:${query.trim()}`;
  const cached = searches.get(key);
  if (cached) return cached;
  const data = placesResponse.parse(
    await request(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${encodeURIComponent(language)}&q=${encodeURIComponent(query.trim())}`,
      signal
    )
  );
  const result = data.map((place) => ({
    latitude: place.lat,
    longitude: place.lon,
    name: place.display_name,
  }));
  if (searches.size >= 30) searches.clear();
  searches.set(key, result);
  return result;
}

export async function calculateWorkoutRoute(
  start: RoutePoint,
  destination: RoutePlace,
  sport: RecordingSport,
  roundTrip: boolean,
  signal: AbortSignal
): Promise<PlannedRoute> {
  const waypoints = roundTrip
    ? [start, destination, start]
    : [start, destination];
  const profile = sport === 'ride' ? 'bike' : 'foot';
  const coordinates = waypoints
    .map((point) => `${point.longitude},${point.latitude}`)
    .join(';');
  const data = routeResponse.parse(
    await request(
      `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson`,
      signal
    )
  );
  const route = data.routes[0];
  return {
    destination: destination.name,
    destinationPoint: {
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
    distance: route.distance,
    roundTrip,
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  };
}
