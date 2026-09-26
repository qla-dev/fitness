import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface PhotoTextColorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}
const colors = [
  '#FFFFFF',
  '#000000',
  '#FF453A',
  '#FF9F0A',
  '#FFD60A',
  '#30D158',
  '#64D2FF',
  '#0A84FF',
  '#BF5AF2',
  '#FF375F',
];

export default function PhotoTextColor({
  value,
  onChange,
  label: suppliedLabel,
}: PhotoTextColorProps) {
  const { t } = useTranslation();
  const label =
    suppliedLabel ??
    t('recording.editor.textColor', { defaultValue: 'Text color' });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const valid = /^#[0-9a-f]{6}$/i.test(draft);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        style={{
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: value,
            borderWidth: 2,
            borderColor: '#888',
          }}
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: 'rgba(0,0,0,0.7)',
          }}
        >
          <View
            style={{
              backgroundColor: '#222',
              padding: 24,
              borderRadius: 24,
              gap: 20,
            }}
          >
            <Text style={{ color: 'white', fontSize: 20 }}>{label}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {colors.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={color}
                  onPress={() => setDraft(color)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: color,
                    borderWidth: draft === color ? 3 : 1,
                    borderColor: '#999',
                  }}
                />
              ))}
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="characters"
              maxLength={7}
              accessibilityLabel={t('recording.editor.hexColor', {
                defaultValue: 'Hex color',
              })}
              style={{
                color: 'white',
                borderWidth: 1,
                borderColor: '#777',
                borderRadius: 12,
                padding: 12,
              }}
            />
            <Pressable
              disabled={!valid}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
              style={{ opacity: valid ? 1 : 0.4, padding: 12 }}
            >
              <Text style={{ color: 'white', textAlign: 'center' }}>
                {t('common.done', { defaultValue: 'Done' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
