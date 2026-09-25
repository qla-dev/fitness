import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import Icon from './Icon';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

// Google Maps refuses to initialise without `com.google.android.geo.API_KEY`
// in the manifest and throws from native code, which no error boundary
// catches. The key reaches the manifest through `android.config.googleMaps`
// in app.config.ts, so its absence there means its absence in the build.
const hasGoogleMapsApiKey = (): boolean =>
  Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);

export type RouteCoordinate = { latitude: number; longitude: number };

export interface RouteMapProps {
  navigationMode?: boolean;
  /** Where the camera starts. Defaults to a wide view when unknown. */
  center?: RouteCoordinate;
  zoom?: number;
  /** The path travelled so far, drawn as a single line. */
  route?: RouteCoordinate[];
  /** Separate segments prevent drawing across pauses and GPS outages. */
  segments?: RouteCoordinate[][];
  /**
   * Draw the blue dot and offer the recentre button. Requires an OS location
   * permission to have been granted — with none, both platforms simply render
   * the map without it rather than failing.
   */
  showsUserLocation?: boolean;
  /**
   * `dark`: the map is a full-bleed background under content rather than a
   * boxed panel, on a screen that is black whatever the theme (the recorder).
   * Only the keyless-Android notice reads it — a filled panel of the theme's
   * surface colour behind the readings is the wrong thing there.
   */
  appearance?: 'dark';
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
  appearance,
  route,
  segments,
  showsUserLocation = false,
  navigationMode = false,
}) => {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const appleMap = useRef<AppleMaps.MapView>(null);
  const googleMap = useRef<GoogleMaps.MapView>(null);
  const [following, setFollowing] = useState(true);
  const [initialCamera] = useState({
    coordinates: center,
    zoom: zoom ?? (center ? ROUTE_ZOOM : DEFAULT_ZOOM),
  });
  // Follow position through the ref, as in SmartFreight. Free exploration stops
  // follow immediately; do not overwrite the user's pan, zoom or 3D choice.
  useEffect(() => {
    if (!navigationMode || !following || !center) return;
    const camera = {
      coordinates: {
        latitude: center.latitude - (360 / 2 ** 17) * 0.12,
        longitude: center.longitude,
      },
      zoom: 17,
    };
    if (Platform.OS === 'ios') appleMap.current?.setCameraPosition(camera);
    else if (Platform.OS === 'android')
      void googleMap.current?.setCameraPosition({ ...camera, duration: 800 });
  }, [navigationMode, following, center]);

  const cameraPosition = navigationMode
    ? initialCamera
    : {
        coordinates: center,
        zoom: zoom ?? (center ? ROUTE_ZOOM : DEFAULT_ZOOM),
      };
  // A single-point line renders nothing on either platform and a zero-length
  // one is rejected outright, so the layer only exists once there are two.
  const polylines = segments
    ? segments
        .filter((segment) => segment.length > 1)
        .map((coordinates, index) => ({
          id: `route-${index}`,
          coordinates,
          color: accent,
          width: ROUTE_WIDTH,
        }))
    : route && route.length > 1
      ? [{ id: 'route', coordinates: route, color: accent, width: ROUTE_WIDTH }]
      : [];

  if (Platform.OS === 'ios') {
    return (
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponderCapture={() => {
          setFollowing(false);
          return false;
        }}
      >
        <AppleMaps.View
          ref={appleMap}
          style={StyleSheet.absoluteFill}
          cameraPosition={cameraPosition}
          polylines={polylines}
          properties={{ isMyLocationEnabled: showsUserLocation }}
          uiSettings={{
            myLocationButtonEnabled: showsUserLocation,
            compassEnabled: true,
            scaleBarEnabled: false,
            togglePitchEnabled: true,
          }}
          colorScheme={
            scheme === 'dark' ? AppleMaps.MapColorScheme.DARK : undefined
          }
        />
        {navigationMode && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('recording.followRoute', {
              defaultValue: 'Follow my position',
            })}
            onPress={() => setFollowing(true)}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: '#222',
              borderRadius: 24,
              padding: 12,
            }}
          >
            <Icon name="gps-track" size={24} color="white" />
          </Pressable>
        )}
      </View>
    );
  }

  if (Platform.OS === 'android' && !hasGoogleMapsApiKey()) {
    // Nothing at all under content: every part of a full-bleed layer is
    // already spoken for by the readings and the control panel over it, so
    // the notice could only land behind one of them. A panel of the theme's
    // surface colour would be worse still on a screen that is black whatever
    // the theme. The boxed uses below keep the explanation.
    if (appearance === 'dark') return null;
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-text-muted text-sm text-center px-6">
          {t('routeMap.missingApiKey', {
            defaultValue:
              'The map is unavailable: this build has no Google Maps API key.',
          })}
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponderCapture={() => {
          setFollowing(false);
          return false;
        }}
      >
        <GoogleMaps.View
          ref={googleMap}
          style={StyleSheet.absoluteFill}
          cameraPosition={cameraPosition}
          polylines={polylines}
          properties={{ isMyLocationEnabled: showsUserLocation }}
          uiSettings={{
            myLocationButtonEnabled: showsUserLocation,
            compassEnabled: true,
            scaleBarEnabled: false,
            tiltGesturesEnabled: true,
          }}
          colorScheme={
            scheme === 'dark' ? GoogleMaps.MapColorScheme.DARK : undefined
          }
        />
        {navigationMode && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('recording.followRoute', {
              defaultValue: 'Follow my position',
            })}
            onPress={() => setFollowing(true)}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: '#222',
              borderRadius: 24,
              padding: 12,
            }}
          >
            <Icon name="gps-track" size={24} color="white" />
          </Pressable>
        )}
      </View>
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
