import React from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

export type RouteCoordinate = { latitude: number; longitude: number };

export interface RouteMapProps {
  /** Where the camera starts. Defaults to a wide view when unknown. */
  center?: RouteCoordinate;
  zoom?: number;
  /** The path travelled so far, drawn as a single line. */
  route?: RouteCoordinate[];
  /**
   * Draw the blue dot and offer the recentre button. Requires an OS location
   * permission to have been granted — with none, both platforms simply render
   * the map without it rather than failing.
   */
  showsUserLocation?: boolean;
}

/** The camera when there is nothing to centre on yet — the whole world. */
const DEFAULT_ZOOM = 2;
/** Close enough to read streets, once there IS something to centre on. */
export const ROUTE_ZOOM = 15;
const ROUTE_WIDTH = 6;

/**
 * The map behind a recorded activity: one line for the route travelled, and
 * optionally the user's own position.
 *
 * expo-maps has no common view — it exposes Apple Maps and Google Maps as two
 * components with two prop types that happen to line up. This is the seam that
 * hides that split, so screens hold one map and not a platform branch.
 */
const RouteMap: React.FC<RouteMapProps> = ({
  center,
  zoom,
  route,
  showsUserLocation = false,
}) => {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const accent = useCSSVariable('--color-accent-primary') as string;

  const cameraPosition = {
    coordinates: center,
    zoom: zoom ?? (center ? ROUTE_ZOOM : DEFAULT_ZOOM),
  };
  // A single-point line renders nothing on either platform and a zero-length
  // one is rejected outright, so the layer only exists once there are two.
  const polylines =
    route && route.length > 1
      ? [{ id: 'route', coordinates: route, color: accent, width: ROUTE_WIDTH }]
      : [];

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        polylines={polylines}
        properties={{ isMyLocationEnabled: showsUserLocation }}
        uiSettings={{
          myLocationButtonEnabled: showsUserLocation,
          compassEnabled: true,
          scaleBarEnabled: false,
        }}
        colorScheme={
          scheme === 'dark' ? AppleMaps.MapColorScheme.DARK : undefined
        }
      />
    );
  }

  if (Platform.OS === 'android') {
    return (
      <GoogleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        polylines={polylines}
        properties={{ isMyLocationEnabled: showsUserLocation }}
        uiSettings={{
          myLocationButtonEnabled: showsUserLocation,
          compassEnabled: true,
          scaleBarEnabled: false,
        }}
        colorScheme={
          scheme === 'dark' ? GoogleMaps.MapColorScheme.DARK : undefined
        }
      />
    );
  }

  // expo-maps ships no web implementation, and the bare native view would
  // throw rather than render, so the surface says so instead of crashing.
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Text className="text-text-muted text-sm text-center px-6">
        {t('routeMap.unsupported', {
          defaultValue: 'Maps are only available on iOS and Android.',
        })}
      </Text>
    </View>
  );
};

export default RouteMap;
