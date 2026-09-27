import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function MarkaiUserMessage({
  text,
  pending = false,
  failed = false,
  onRetry,
}: {
  text: string;
  pending?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      disabled={!failed}
      onPress={onRetry}
      accessibilityRole={failed ? 'button' : undefined}
      className="bg-accent-primary"
      style={{
        alignSelf: 'flex-end',
        maxWidth: '85%',
        borderRadius: 18,
        paddingHorizontal: 13,
        paddingVertical: 9,
        opacity: pending ? 0.65 : 1,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 25 }}>
        {text}
      </Text>
      {failed ? (
        <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 6 }}>
          {t('markai.retry', { defaultValue: 'Not sent. Tap to retry.' })}
        </Text>
      ) : null}
    </Pressable>
  );
}
