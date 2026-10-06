import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import FormInput from '../FormInput';
import RouteMap from '../RouteMap';
import Icon from '../Icon';
import {
  searchRoutePlaces,
  type RoutePlace,
  type RoutePoint,
} from '../../services/recording/routePlanner';

/**
 * Choose one place by address search or by tapping the map, with the person's
 * own position found first so the map opens where they are. The workout route
 * sheet picks its destination with it, and the photo editor a photo's
 * location; each wraps it in its own NativePromptSheet.
 */
export default function PlacePicker({
  tint,
  initialQuery = '',
  selected,
  onChoose,
  onLocated,
  onLocationFailed,
  onLocationRetry,
  plannedRoute,
  error: outsideError,
  selectedTitle,
  footer,
  children,
}: {
  tint: string;
  initialQuery?: string;
  selected?: RoutePlace;
  onChoose: (place: RoutePlace) => void;
  /** The person's position, once found. */
  onLocated?: (point: RoutePoint) => void;
  onLocationFailed?: () => void;
  onLocationRetry?: () => void;
  plannedRoute?: RoutePoint[];
  /** An error from the caller's own work (routing), shown over ours. */
  error?: string;
  /** The map marker's title for the chosen place. */
  selectedTitle?: string;
  /** The line under the map: a hint, or what the choice amounts to. */
  footer: string;
  /** Controls between the search field and the map (route options). */
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<RoutePlace[]>([]);
  const [start, setStart] = useState<RoutePoint>();
  const [searching, setSearching] = useState(false);
  const [ownError, setOwnError] = useState('');
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [locating, setLocating] = useState(true);
  const searchRequest = useRef<AbortController | null>(null);
  // Callbacks change identity every render; the location effect must not.
  const located = useRef(onLocated);
  const failed = useRef(onLocationFailed);
  useEffect(() => {
    located.current = onLocated;
    failed.current = onLocationFailed;
  });
  useEffect(() => () => searchRequest.current?.abort(), []);
  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      failed.current?.();
      setOwnError(
        t('workoutRoute.locationError', {
          defaultValue:
            'Allow location access and try again to set your starting point.',
        })
      );
    };
    const timeout = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        setLocating(false);
        fail();
      }
    }, 20000);
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location unavailable');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!cancelled) {
        setStart(location.coords);
        located.current?.(location.coords);
        setOwnError('');
      }
    })()
      .catch(() => {
        if (!cancelled) fail();
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLocating(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [locationAttempt, t]);
  const choose = (place: RoutePlace) => {
    searchRequest.current?.abort();
    setSearching(false);
    Keyboard.dismiss();
    setQuery(place.name);
    setResults([]);
    setOwnError('');
    onChoose(place);
  };
  const search = async () => {
    if (query.trim().length < 3) return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearching(true);
    setOwnError('');
    Keyboard.dismiss();
    try {
      const places = await searchRoutePlaces(
        query,
        i18n.language,
        controller.signal
      );
      if (controller.signal.aborted) return;
      setResults(places);
      if (!places.length)
        setOwnError(
          t('workoutRoute.noResults', {
            defaultValue:
              'No places found. Try another address or tap the map.',
          })
        );
    } catch {
      if (!controller.signal.aborted)
        setOwnError(
          t('workoutRoute.searchError', {
            defaultValue:
              'Address search is unavailable. Try again or tap the map.',
          })
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };
  const points =
    plannedRoute ??
    (start && selected
      ? [start, selected]
      : start
        ? [start]
        : selected
          ? [selected]
          : []);
  const bounds = points.reduce(
    (box, point) => ({
      minLat: Math.min(box.minLat, point.latitude),
      maxLat: Math.max(box.maxLat, point.latitude),
      minLon: Math.min(box.minLon, point.longitude),
      maxLon: Math.max(box.maxLon, point.longitude),
    }),
    { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity }
  );
  const span = points.length
    ? Math.max(bounds.maxLat - bounds.minLat, bounds.maxLon - bounds.minLon)
    : 0;
  const center = points.length
    ? {
        latitude: (bounds.maxLat + bounds.minLat) / 2,
        longitude: (bounds.maxLon + bounds.minLon) / 2,
      }
    : undefined;
  const error = outsideError || ownError;
  return (
    <View className="flex-1 gap-3">
      <View className="flex-row items-center gap-2">
        <FormInput
          className="flex-1"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={() => void search()}
          placeholder={t('workoutRoute.search', {
            defaultValue: 'Search address or place',
          })}
          accessibilityLabel={t('workoutRoute.search', {
            defaultValue: 'Search address or place',
          })}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workoutRoute.searchButton', {
            defaultValue: 'Search',
          })}
          disabled={searching || query.trim().length < 3}
          onPress={() => void search()}
          style={{ padding: 12 }}
        >
          {searching ? (
            <ActivityIndicator color={tint} />
          ) : (
            <Icon name="search" size={24} color={tint} />
          )}
        </Pressable>
      </View>
      {children}
      {results.length > 0 && (
        <ScrollView
          style={{ maxHeight: 150 }}
          keyboardShouldPersistTaps="handled"
        >
          {results.map((place, index) => (
            <Pressable
              key={`${place.latitude}:${place.longitude}:${index}`}
              accessibilityRole="button"
              onPress={() => choose(place)}
              className="py-3 border-b border-border"
            >
              <Text className="text-text-primary">{place.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {error ? (
        <Text accessibilityRole="alert" className="text-text-secondary">
          {error}
        </Text>
      ) : null}
      {!start && !locating && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLocating(true);
            setOwnError('');
            onLocationRetry?.();
            setLocationAttempt((value) => value + 1);
          }}
        >
          <Text style={{ color: tint }}>
            {t('workoutRoute.locate', {
              defaultValue: 'Find my starting point',
            })}
          </Text>
        </Pressable>
      )}
      <View
        className="flex-1 rounded-3xl overflow-hidden"
        style={{ minHeight: 180 }}
      >
        <RouteMap
          center={center}
          zoom={span ? Math.max(2, Math.min(15, Math.log2(180 / span))) : 15}
          plannedRoute={plannedRoute}
          destination={selected}
          destinationTitle={selectedTitle}
          showsUserLocation={!!start}
          onSelectPoint={(point) =>
            choose({
              ...point,
              name: t('workoutRoute.selectedPoint', {
                defaultValue: 'Selected point',
              }),
            })
          }
        />
        {locating && (
          <View
            testID="route-location-loading"
            accessibilityLiveRegion="polite"
            accessibilityState={{ busy: true }}
            className="absolute inset-0 bg-surface/90 items-center justify-center gap-3 px-6"
          >
            <ActivityIndicator size="large" color={tint} />
            <Text className="text-text-primary text-center">
              {t('workoutRoute.locating', {
                defaultValue: 'Searching for your location…',
              })}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-text-secondary">{footer}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workoutRoute.mapCredits', {
          defaultValue: 'Map credits',
        })}
        className="self-end p-2"
        onPress={() =>
          Alert.alert(
            t('workoutRoute.mapCredits', { defaultValue: 'Map credits' }),
            t('workoutRoute.attribution', {
              defaultValue:
                '© OpenStreetMap contributors · Routing: FOSSGIS · Fix the map',
            }),
            [
              {
                text: t('common.close', { defaultValue: 'Close' }),
                style: 'cancel',
              },
              {
                text: t('workoutRoute.fixMap', {
                  defaultValue: 'Fix the map',
                }),
                onPress: () =>
                  void Linking.openURL(
                    'https://www.openstreetmap.org/fixthemap'
                  ),
              },
            ]
          )
        }
      >
        <Icon name="info-circle" size={18} color={tint} />
      </Pressable>
    </View>
  );
}
