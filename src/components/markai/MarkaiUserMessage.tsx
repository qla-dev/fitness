import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import MarkaiPhoto from './MarkaiPhoto';

export default function MarkaiUserMessage({
  text,
  imageUri,
  hasImage = false,
  pending = false,
  failed = false,
  onRetry,
}: {
  text: string;
  /** The photo sent from this device. */
  imageUri?: string;
  /** A photo was sent but only its flag came back with the history. */
  hasImage?: boolean;
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
      {imageUri ? (
        <View style={{ marginBottom: text ? 8 : 0 }}>
          <MarkaiPhoto uri={imageUri} scanning={pending} />
        </View>
      ) : hasImage ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: text ? 6 : 0,
          }}
        >
          <Icon name="photo-library" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
            {t('markai.photo', { defaultValue: 'Photo' })}
          </Text>
        </View>
      ) : null}
      {text ? (
        <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 25 }}>
          {text}
        </Text>
      ) : null}
      {failed ? (
        <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 6 }}>
          {t('markai.retry', { defaultValue: 'Not sent. Tap to retry.' })}
        </Text>
      ) : null}
    </Pressable>
  );
}
