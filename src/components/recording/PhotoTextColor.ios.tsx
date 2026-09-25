import { ColorPicker, Host } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { useTranslation } from 'react-i18next';
import type { PhotoTextColorProps } from './PhotoTextColor';

export default function PhotoTextColor({
  value,
  onChange,
}: PhotoTextColorProps) {
  const { t } = useTranslation();
  const label = t('recording.editor.textColor', { defaultValue: 'Text color' });
  return (
    <Host style={{ width: 48, height: 48 }} colorScheme="dark">
      <ColorPicker
        label={label}
        selection={value}
        onSelectionChange={onChange}
        supportsOpacity={false}
        modifiers={[labelsHidden(), accessibilityLabel(label)]}
      />
    </Host>
  );
}
