import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import NativePromptSheet from '../ui/NativePromptSheet';
import FormInput from '../FormInput';
import FilterChipRow from '../FilterChipRow';
import RouteMap from '../RouteMap';
import Icon from '../Icon';
import {
  calculateWorkoutRoute,
  searchRoutePlaces,
  type RoutePlace,
  type RoutePoint,
} from '../../services/recording/routePlanner';
import type {
  PlannedRoute,
  RecordingSport,
} from '../../services/recording/types';
import { distanceFromKm } from '../../utils/unitConversions';
import { formatLocalizedNumber } from '../../localization';

export default function WorkoutRouteSheet({
  sport,
  distanceUnit,
  onSave,
  onClose,
  value,
}: {
  sport: RecordingSport;
  distanceUnit: 'km' | 'miles';
  onSave: (route: PlannedRoute) => void;
  onClose: () => void;
  value?: PlannedRoute;
}) {
  const { t, i18n } = useTranslation();
  const tint = useCSSVariable('--color-cat-violet') as string;
  const [query, setQuery] = useState(value?.destination ?? '');
  const [results, setResults] = useState<RoutePlace[]>([]);
  const [start, setStart] = useState<RoutePoint>();
  const [destination, setDestination] = useState<RoutePlace | undefined>(
    value ? { ...value.destinationPoint, name: value.destination } : undefined
  );
  const [roundTrip, setRoundTrip] = useState(value?.roundTrip ?? true);
  const [plan, setPlan] = useState<PlannedRoute>();
  const [routing, setRouting] = useState(!!value);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [locationAttempt, setLocationAttempt] = useState(0);
  const searchRequest = useRef<AbortController | null>(null);
  useEffect(() => () => searchRequest.current?.abort(), []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location unavailable');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!cancelled) {
        setStart(location.coords);
        setError('');
      }
    })().catch(() => {
      if (!cancelled)
        setError(
          t('workoutRoute.locationError', {
            defaultValue:
              'Allow location access and try again to set your starting point.',
          })
        );
    });
    return () => {
      cancelled = true;
    };
  }, [locationAttempt, t]);
  useEffect(() => {
    if (!start || !destination) return;
    const controller = new AbortController();
    void calculateWorkoutRoute(
      start,
      destination,
      sport,
      roundTrip,
      controller.signal
    )
      .then((route) => {
        if (!controller.signal.aborted) setPlan(route);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            t('workoutRoute.routeError', {
              defaultValue:
                'Could not calculate this route. Select another point or try again.',
            })
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });
    return () => controller.abort();
  }, [start, destination, sport, roundTrip, t]);
  const choose = (place: RoutePlace) => {
    searchRequest.current?.abort();
    setSearching(false);
    Keyboard.dismiss();
    setDestination(place);
    setQuery(place.name);
    setResults([]);
    setPlan(undefined);
    setError('');
    setRouting(true);
  };
  const search = async () => {
    if (query.trim().length < 3) return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearching(true);
    setError('');
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
        setError(
          t('workoutRoute.noResults', {
            defaultValue:
              'No places found. Try another address or tap the map.',
          })
        );
    } catch {
      if (!controller.signal.aborted)
        setError(
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
    plan?.coordinates ??
    (start && destination ? [start, destination] : start ? [start] : []);
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
  return (
    <NativePromptSheet
      open
      onClose={onClose}
      title={t('workoutRoute.title', { defaultValue: 'Route' })}
      hasTextInput
      footerTint={tint}
      footerLabel={t('workoutRoute.useRoute', { defaultValue: 'Use route' })}
      footerDisabled={!plan || routing}
      footerLoading={routing}
      onFooterPress={() => {
        if (plan) {
          onSave(plan);
          onClose();
        }
      }}
    >
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
        <View>
          <FilterChipRow
            value={roundTrip ? 'round' : 'one'}
            clearValue={roundTrip ? 'round' : 'one'}
            options={[
              {
                value: 'one',
                label: t('workoutRoute.oneWay', { defaultValue: 'One way' }),
                icon: 'chevron-forward',
              },
              {
                value: 'round',
                label: t('workoutRoute.roundTrip', {
                  defaultValue: 'Round trip',
                }),
                icon: 'repeat',
              },
            ]}
            onChange={(value) => {
              const next = value === 'round';
              if (next !== roundTrip) {
                setRoundTrip(next);
                setPlan(undefined);
                setRouting(!!destination);
                setError('');
              }
            }}
          />
        </View>
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
        {!start && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setLocationAttempt((value) => value + 1)}
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
            plannedRoute={plan?.coordinates}
            destination={destination}
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
        </View>
        <Text className="text-text-secondary">
          {plan
            ? t('workoutRoute.distance', {
                defaultValue: '{{distance}} {{unit}} planned',
                distance: formatLocalizedNumber(
                  distanceFromKm(plan.distance / 1000, distanceUnit),
                  { maximumFractionDigits: 2 }
                ),
                unit:
                  distanceUnit === 'miles'
                    ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
                    : t('workoutSetup.kmUnit', { defaultValue: 'KM' }),
              })
            : t('workoutRoute.hint', {
                defaultValue: 'Search or tap the map to choose a destination.',
              })}
        </Text>
        <Text
          className="text-text-muted text-xs pb-2"
          onPress={() =>
            void Linking.openURL('https://www.openstreetmap.org/fixthemap')
          }
        >
          {t('workoutRoute.attribution', {
            defaultValue:
              '© OpenStreetMap contributors · Routing: FOSSGIS · Fix the map',
          })}
        </Text>
      </View>
    </NativePromptSheet>
  );
}
