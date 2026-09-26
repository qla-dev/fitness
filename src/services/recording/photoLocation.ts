import * as Location from 'expo-location';
import type { PhotoComposition } from './types';

/** A missing GPS fix never prevents a photo. Never substitute a stale route endpoint. */
export async function capturePhotoLocation(): Promise<
  PhotoComposition['captureLocation']
> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return undefined;
        const location =
          (await Location.getLastKnownPositionAsync({
            maxAge: 10000,
            requiredAccuracy: 100,
          })) ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }));
        const { latitude, longitude } = location.coords;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180 ||
          !Number.isFinite(location.timestamp) ||
          Date.now() - location.timestamp > 15000
        )
          return undefined;
        return { latitude, longitude, timestamp: location.timestamp };
      })(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), 4000);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
