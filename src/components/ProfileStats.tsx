import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import Icon, { type IconName } from './Icon';
import MeasurementRecordSheet from './MeasurementRecordSheet';
import { fetchProfile } from '../services/api/profileApi';
import { profileQueryKey } from '../hooks/queryKeys';
import { usePreferences } from '../hooks/usePreferences';
import { useMeasurementHistory } from '../hooks/useMeasurementHistory';
import { measurementFieldById } from '../utils/measurementFields';
import { getTodayDate } from '../utils/dateUtils';
import { fireSelectionHaptic } from '../services/haptics';

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
 * tiles use. Age is shown, not edited: it is derived from the stored date of
 * birth, and there is no date-of-birth editor to send the user to yet.
 */
export default function ProfileStats({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const [editingHeight, setEditingHeight] = useState(false);
  const today = getTodayDate();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;

  const { data: profile } = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled,
  });
  const { preferences } = usePreferences({ enabled });
  const heightMode = preferences?.default_measurement_unit ?? 'cm';
  // The same 120-day window the diary tiles read, so this shares their cache
  // rather than opening an all-time range of its own.
  const { history } = useMeasurementHistory(today, enabled);

  const heightField = measurementFieldById('height');
  const storedHeight = history?.height?.shown ?? null;
  const age = ageFromDateOfBirth(profile?.date_of_birth);

  // The same icons the setup wizard puts on these two questions, so the answer
  // is marked the way the question was — drawn bare and in the accent colour,
  // the way the Library cards directly below this one draw theirs.
  const stats: {
    key: string;
    icon: IconName;
    label: string;
    value: string;
    onPress?: () => void;
  }[] = [
    {
      key: 'age',
      icon: 'calendar',
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
    },
    {
      key: 'height',
      icon: 'measurements',
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
        setEditingHeight(true);
      },
    },
  ];

  return (
    <>
      <View className="bg-surface rounded-2xl overflow-hidden mb-5 flex-row">
        {stats.map((stat, index) => {
          const body = (
            <View className="flex-row items-center px-3 py-3">
              <Icon name={stat.icon} size={24} color={accentPrimary} />
              <View className="flex-1 ml-4">
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
      {editingHeight && (
        <MeasurementRecordSheet
          field="height"
          // Recorded against today: height is not tied to a day the way a
          // weigh-in is, and this screen has no date of its own to record for.
          date={today}
          current={storedHeight}
          units={{ heightMode }}
          onClose={() => setEditingHeight(false)}
        />
      )}
    </>
  );
}
