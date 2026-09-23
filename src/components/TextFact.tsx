import { Text, View } from 'react-native';

export default function TextFact({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View className="mb-4">
      <Text
        accessibilityRole="header"
        className="text-lg font-bold text-text-primary mb-3 px-1"
      >
        {title}
      </Text>
      <View className="bg-surface rounded-xl p-4">
        <Text className="text-base leading-6 text-text-primary">{body}</Text>
      </View>
    </View>
  );
}
