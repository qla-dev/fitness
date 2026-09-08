import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  programAccessScope,
  readProgramAccess,
} from '../services/programAccess';
import { formatLocalizedNumber } from '../localization';

export default function ProgramCountdown({
  presetId,
}: {
  presetId: string | number;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const { data: scope } = useQuery({
    queryKey: ['workoutPresetAccessScope'],
    queryFn: programAccessScope,
  });
  const { data: access } = useQuery({
    queryKey: ['workoutPresetAccess', scope, presetId],
    queryFn: () => readProgramAccess(scope!, presetId),
    enabled: !!scope,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!access) return null;
  const days = Math.max(
    0,
    Math.ceil((Date.parse(access.expiresAt) - now) / 86400000)
  );
  return (
    <Text
      className="text-text-secondary text-xs text-right"
      style={{ maxWidth: 100 }}
    >
      {days > 0
        ? t('profile.library.daysLeft', {
            count: days,
            formattedCount: formatLocalizedNumber(days),
            defaultValue: '{{formattedCount}} days left',
            defaultValue_one: '{{formattedCount}} day left',
            defaultValue_other: '{{formattedCount}} days left',
          })
        : t('profile.library.expired', { defaultValue: 'Expired' })}
    </Text>
  );
}
