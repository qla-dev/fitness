import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import TileIconSlot from './TileIconSlot';
import { HeightIcon } from './icons/measurements';
import { AgeIcon } from './icons/profile';
import { useProfileSetup } from '../hooks/useProfileSetup';
import { fetchProfile } from '../services/api/profileApi';
import { profileQueryKey } from '../hooks/queryKeys';
import { usePreferences } from '../hooks/usePreferences';
import { useMeasurementHistory } from '../hooks/useMeasurementHistory';
import { measurementFieldById } from '../utils/measurementFields';
import { getTodayDate } from '../utils/dateUtils';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackParamList } from '../types/navigation';

/** Years between a stored date of birth and today, or null when unusable. */
export const ageFromDateOfBirth = (
  dateOfBirth: string | null | undefined,
  today: Date = new Date()
): number | null => {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (!Number.isFinite(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 150 ? age : null;
};

const EMPTY = '—';

/**
 * Age and height, side by side under the name.
 *
 * Both are standing facts about the person rather than things recorded on a
 * given day, which is why height moved off the diary's measurement tiles and
 * landed here — nobody logs their height on a Tuesday, and a tile for it among
 * the daily ones only ever read as clutter. It is still stored on the check-in
 * like any other measurement; only where it is shown has changed.
 *
 * Height is editable in place through the same one-field sheet the measurement
 * tiles use. Age opens the personal setup's own Age step on its own, saved
 * from there: the wizard is where age is asked, and it writes the date of
 * birth this tile reads.
 */
export default function ProfileStats({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const today = getTodayDate();
  const [accentPrimary, iconDecorative] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
  ]) as [string, string];

  const { data: profile } = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled,
  });
  const { preferences } = usePreferences({ enabled });
  const setup = useProfileSetup(enabled);
  const heightMode = preferences?.default_measurement_unit ?? 'cm';
  // The same 120-day window the diary tiles read, so this shares their cache
  // rather than opening an all-time range of its own.
  const { history } = useMeasurementHistory(today, enabled);

  const heightField = measurementFieldById('height');
  const storedHeight = history?.height?.shown ?? null;
  const age = ageFromDateOfBirth(profile?.date_of_birth);

  // Drawn icons rather than the shared symbol set, and the same two-tone pair
  // the measurement tiles use — because that is what these two are. The height
  // icon is literally the one its tile used before height moved up here.
  const stats: {
    key: string;
    Icon: React.ComponentType<{
      size?: number;
      color?: string;
      accentColor?: string;
    }>;
    label: string;
    value: string;
    onPress?: () => void;
  }[] = [
    {
      key: 'age',
      Icon: AgeIcon,
      label: t('profile.age', { defaultValue: 'Age' }),
      value:
        age === null
          ? EMPTY
          : t('profile.ageValue', {
              count: age,
              defaultValue: '{{count}} years',
              defaultValue_one: '{{count}} year',
              defaultValue_other: '{{count}} years',
            }),
      onPress: () => {
        fireSelectionHaptic();
        setup.openWizard(
          () => navigation.navigate('SetupWizard'),
          undefined,
          'age'
        );
      },
    },
    {
      key: 'height',
      Icon: HeightIcon,
      label: t('measurements.fields.height', { defaultValue: 'Height' }),
      value:
        storedHeight === null
          ? EMPTY
          : heightField.format(storedHeight, {
              weightMode: 'kg',
              bodyUnit: 'cm',
              heightMode,
            }),
      onPress: () => {
        fireSelectionHaptic();
        // Recorded against today: height is not tied to a day the way a
        // weigh-in is, and this screen has no date of its own to record for.
        navigation.navigate('MeasurementEdit', {
          field: 'height',
          date: today,
          current: storedHeight,
          units: { heightMode },
        });
      },
    },
  ];

  return (
    <>
      <View className="bg-surface rounded-2xl overflow-hidden mb-5 flex-row">
        {stats.map((stat, index) => {
          const body = (
            <View className="flex-row items-center px-3 py-3">
              {/* The tracker tiles' slot and size, so a profile stat is drawn
                  at exactly the scale its measurement siblings are. */}
              <TileIconSlot>
                <stat.Icon
                  size={56}
                  color={iconDecorative}
                  accentColor={accentPrimary}
                />
              </TileIconSlot>
              <View className="flex-1 ml-2">
                <Text
                  className="text-text-secondary text-sm"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {stat.label}
                </Text>
                <Text
                  className="text-text-primary text-lg font-bold"
                  numberOfLines={1}
                >
                  {stat.value}
                </Text>
              </View>
            </View>
          );
          return (
            <View key={stat.key} className="flex-1 flex-row">
              {/* Between the two, not around them: a rule on the outer edge
                  would sit on the card's own rounded corner. */}
              {index > 0 && <View className="w-px bg-border-subtle my-3" />}
              <View className="flex-1">
                {stat.onPress ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={stat.label}
                    onPress={stat.onPress}
                  >
                    {body}
                  </Pressable>
                ) : (
                  body
                )}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}
