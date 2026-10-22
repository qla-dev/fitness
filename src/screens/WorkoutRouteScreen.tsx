import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import PromptScreen from '../components/ui/PromptScreen';
import FilterChipRow from '../components/FilterChipRow';
import PlacePicker from '../components/recording/PlacePicker';
import {
  calculateWorkoutRoute,
  NoDistinctReturnRouteError,
  type RoutePlace,
  type RoutePoint,
} from '../services/recording/routePlanner';
import type { PlannedRoute } from '../services/recording/types';
import { distanceFromKm } from '../utils/unitConversions';
import { formatLocalizedNumber } from '../localization';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * The destination of a route workout, for `WorkoutSetup`. Modal, like
 * GoalEdit; Use route hands the plan back through the setup screen's
 * `plannedRoute` param.
 */
export default function WorkoutRouteScreen({
  navigation,
  route,
}: RootStackScreenProps<'WorkoutRoute'>) {
  const { sport, distanceUnit, value } = route.params;
  const { t } = useTranslation();
  const tint = useCSSVariable('--color-cat-violet') as string;
  const [start, setStart] = useState<RoutePoint>();
  const [destination, setDestination] = useState<RoutePlace | undefined>(
    value ? { ...value.destinationPoint, name: value.destination } : undefined
  );
  const [roundTrip, setRoundTrip] = useState(value?.roundTrip ?? true);
  const [plan, setPlan] = useState<PlannedRoute>();
  const [routing, setRouting] = useState(!!value);
  const [error, setError] = useState('');
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
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof NoDistinctReturnRouteError
              ? t('workoutRoute.noReturnRoute', {
                  defaultValue:
                    'No different return route was found. Try another destination or choose One way.',
                })
              : t('workoutRoute.routeError', {
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
  return (
    <PromptScreen
      headerTitle={t('workoutSetup.filters.goals', { defaultValue: 'Goals' })}
      title={t('workoutRoute.title', { defaultValue: 'Route' })}
      hasTextInput
      footerTint={tint}
      footerLabel={t('workoutRoute.useRoute', { defaultValue: 'Use route' })}
      footerDisabled={!plan || routing}
      footerLoading={routing}
      onFooterPress={() => {
        if (plan)
          navigation.popTo(
            'WorkoutSetup',
            { sport, plannedRoute: plan },
            { merge: true }
          );
      }}
    >
      <PlacePicker
        tint={tint}
        initialQuery={value?.destination}
        selected={destination}
        plannedRoute={plan?.coordinates}
        error={error}
        onLocated={setStart}
        onLocationFailed={() => setRouting(false)}
        onLocationRetry={() => {
          setRouting(!!destination);
          setError('');
        }}
        onChoose={(place) => {
          setDestination(place);
          setPlan(undefined);
          setError('');
          setRouting(true);
        }}
        footer={
          plan
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
              })
        }
      >
        <View>
          <FilterChipRow
            horizontalPadding={0}
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
      </PlacePicker>
    </PromptScreen>
  );
}
