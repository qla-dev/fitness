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
        legs: z
          .array(
            z.object({
              annotation: z.object({ nodes: z.array(z.number()) }).optional(),
            })
          )
          .optional(),
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

export class NoDistinctReturnRouteError extends Error {
  constructor() {
    super('No distinct return route found');
    this.name = 'NoDistinctReturnRouteError';
  }
}

type ProviderRoute = z.infer<typeof routeResponse>['routes'][number];

/** Compare undirected road edges, so reversing the same road is still overlap. */
function routeEdges(route: ProviderRoute): Set<string> {
  const nodes = route.legs?.flatMap((leg) => leg.annotation?.nodes ?? []);
  const points =
    nodes && nodes.length > 1
      ? nodes.map(String)
      : route.geometry.coordinates.map((point) =>
          point.map((n) => n.toFixed(5)).join(',')
        );
  return new Set(
    points
      .slice(1)
      .map((point, index) => [points[index], point].sort().join('|'))
  );
}

export async function calculateWorkoutRoute(
  start: RoutePoint,
  destination: RoutePlace,
  sport: RecordingSport,
  roundTrip: boolean,
  signal: AbortSignal
): Promise<PlannedRoute> {
  const profile = sport === 'ride' ? 'bike' : 'foot';
  const fetchLeg = async (
    from: RoutePoint,
    to: RoutePoint,
    alternatives: boolean
  ) => {
    const coordinates = [from, to]
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(';');
    const data = routeResponse.parse(
      await request(
        `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&annotations=nodes&alternatives=${alternatives}`,
        signal
      )
    );
    return data.routes;
  };
  const route = (await fetchLeg(start, destination, false))[0];
  let geometry = route.geometry.coordinates;
  let distance = route.distance;
  if (roundTrip) {
    const outboundEdges = routeEdges(route);
    const candidates = await fetchLeg(destination, start, true);
    const ranked = candidates
      .map((candidate) => {
        const edges = routeEdges(candidate);
        const common = [...edges].filter((edge) =>
          outboundEdges.has(edge)
        ).length;
        return {
          candidate,
          overlap:
            common / Math.max(1, Math.min(edges.size, outboundEdges.size)),
        };
      })
      .sort(
        (a, b) =>
          a.overlap - b.overlap || a.candidate.distance - b.candidate.distance
      );
    const returning = ranked.find((item) => item.overlap < 0.85)?.candidate;
    if (!returning) throw new NoDistinctReturnRouteError();
    // Keep road-derived geometry; shared access roads are allowed, but a
    // mostly identical return is not presented as a different round trip.
    geometry = [...geometry, ...returning.geometry.coordinates.slice(1)];
    distance += returning.distance;
  }
  return {
    destination: destination.name,
    destinationPoint: {
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
    distance,
    roundTrip,
    coordinates: geometry.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  };
}
