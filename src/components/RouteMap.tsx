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
import LiquidGlassSurface from './LiquidGlassSurface';

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
  plannedRoute?: RouteCoordinate[];
  destination?: RouteCoordinate;
  onSelectPoint?: (point: RouteCoordinate) => void;
  navigationMode?: boolean;
  controlsTop?: number;
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
  controlsTop = 16,
  plannedRoute,
  destination,
  onSelectPoint,
}) => {
  const { t } = useTranslation();

  const [mapReady, setMapReady] = useState(false);
  const [is3D, setIs3D] = useState(navigationMode);
  const scheme = useColorScheme();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const routeColor = useCSSVariable('--color-cat-violet') as string;
  const appleMap = useRef<AppleMaps.MapView>(null);
  const googleMap = useRef<GoogleMaps.MapView>(null);
  const [following, setFollowing] = useState(true);
  const orientation = useRef({
    tilt: navigationMode ? 60 : 0,
    bearing: 0,
    zoom: 17,
  });
  const [initialCamera, setInitialCamera] = useState({
    coordinates: center,
    tilt: navigationMode ? 60 : 0,
    zoom:
      zoom ??
      (navigationMode && center ? 17 : center ? ROUTE_ZOOM : DEFAULT_ZOOM),
  });
  // The native view may mount before the first GPS fix. A camera at world
  // zoom cannot show a useful pitch; initialize it once that fix arrives.
  if (navigationMode && center && !initialCamera.coordinates) {
    setInitialCamera({ coordinates: center, tilt: 60, zoom: 17 });
  }
  // Follow position through the ref, as in SmartFreight. Free exploration stops
  // follow immediately; do not overwrite the user's pan, zoom or 3D choice.
  useEffect(() => {
    if (!navigationMode || !following || !center) return;
    const camera = {
      coordinates: {
        latitude: center.latitude - (360 / 2 ** 17) * 0.12,
        longitude: center.longitude,
      },
      ...orientation.current,
    };
    if (Platform.OS === 'ios') appleMap.current?.setCameraPosition(camera);
    else if (Platform.OS === 'android')
      void googleMap.current?.setCameraPosition({ ...camera, duration: 800 });
  }, [navigationMode, following, center, mapReady]);

  const cameraPosition = navigationMode
    ? initialCamera
    : {
        coordinates: center,
        zoom: zoom ?? (center ? ROUTE_ZOOM : DEFAULT_ZOOM),
      };
  const controls = navigationMode && (
    <View
      style={{ position: 'absolute', right: 16, top: controlsTop, gap: 10 }}
    >
      <LiquidGlassSurface colorScheme="dark" style={{ borderRadius: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('routeMap.toggle3D', {
            defaultValue: 'Toggle 3D map',
          })}
          accessibilityState={{ selected: is3D }}
          onPress={() => {
            const tilt = is3D ? 0 : 60;
            orientation.current.tilt = tilt;
            setIs3D(!is3D);
            const camera = { ...orientation.current, coordinates: center };
            if (Platform.OS === 'ios')
              appleMap.current?.setCameraPosition(camera);
            else void googleMap.current?.setCameraPosition(camera);
          }}
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            {is3D
              ? t('routeMap.flat', { defaultValue: '2D' })
              : t('routeMap.threeDimensional', { defaultValue: '3D' })}
          </Text>
        </Pressable>
      </LiquidGlassSurface>
      <LiquidGlassSurface colorScheme="dark" style={{ borderRadius: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('recording.followRoute', {
            defaultValue: 'Follow my position',
          })}
          onPress={() => {
            setFollowing(true);
            setMapReady((ready) => !ready);
          }}
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="gps-track" size={22} color="white" />
        </Pressable>
      </LiquidGlassSurface>
    </View>
  );
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
  if (plannedRoute && plannedRoute.length > 1) {
    polylines.unshift({
      id: 'planned-route',
      coordinates: plannedRoute,
      color: routeColor,
      width: 8,
    });
  }
  const markers = destination
    ? [
        {
          id: 'destination',
          coordinates: destination,
          title: t('workoutRoute.destination', { defaultValue: 'Destination' }),
        },
      ]
    : [];
  const selectPoint = (event: {
    coordinates: { latitude?: number; longitude?: number };
  }) => {
    const { latitude, longitude } = event.coordinates;
    if (latitude !== undefined && longitude !== undefined)
      onSelectPoint?.({ latitude, longitude });
  };

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
          onCameraMove={(event) => {
            if (!mapReady) setMapReady(true);
            if (!following)
              orientation.current = {
                tilt: event.tilt,
                bearing: event.bearing,
                zoom: event.zoom,
              };
          }}
          polylines={polylines}
          markers={markers}
          onMapClick={selectPoint}
          properties={{
            isMyLocationEnabled: showsUserLocation,
            elevation: navigationMode
              ? AppleMaps.MapStyleElevation?.REALISTIC
              : undefined,
          }}
          uiSettings={{
            myLocationButtonEnabled: !navigationMode && showsUserLocation,
            compassEnabled: !navigationMode,
            scaleBarEnabled: false,
            togglePitchEnabled: !navigationMode,
          }}
          colorScheme={
            appearance === 'dark' || scheme === 'dark'
              ? AppleMaps.MapColorScheme.DARK
              : undefined
          }
        />
        {appearance === 'dark' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.4)' },
            ]}
          />
        )}
        {controls}
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
          onCameraMove={(event) => {
            if (!mapReady) setMapReady(true);
            if (!following)
              orientation.current = {
                tilt: event.tilt,
                bearing: event.bearing,
                zoom: event.zoom,
              };
          }}
          polylines={polylines}
          markers={markers}
          onMapClick={selectPoint}
          properties={{ isMyLocationEnabled: showsUserLocation }}
          uiSettings={{
            myLocationButtonEnabled: !navigationMode && showsUserLocation,
            compassEnabled: !navigationMode,
            scaleBarEnabled: false,
            tiltGesturesEnabled: true,
          }}
          colorScheme={
            appearance === 'dark' || scheme === 'dark'
              ? GoogleMaps.MapColorScheme.DARK
              : undefined
          }
        />
        {appearance === 'dark' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.4)' },
            ]}
          />
        )}
        {controls}
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
