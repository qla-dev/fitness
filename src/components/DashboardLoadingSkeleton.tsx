import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

interface DashboardLoadingSkeletonProps {
  activeWorkoutBarPadding: number;
  usesNativeTabs: boolean;
}

interface SkeletonLineProps {
  width: number | string;
  textMuted: string;
  className?: string;
}

const SkeletonLine = ({
  width,
  textMuted,
  className = 'h-3',
}: SkeletonLineProps) => (
  <View
    testID="dashboard-skeleton-line"
    className={`${className} rounded-full`}
    style={{ width, backgroundColor: textMuted, opacity: 0.16 }}
  />
);

/**
 * Keeps the Activities screen recognisable while its first server response is
 * in flight. The blocks follow the Dashboard's card layout so the data can
 * replace them without a full-screen loading transition.
 */
export default function DashboardLoadingSkeleton({
  activeWorkoutBarPadding,
  usesNativeTabs,
}: DashboardLoadingSkeletonProps) {
  const { t } = useTranslation();
  const [textMuted] = useCSSVariable(['--color-text-muted']) as string[];
  const skeletonLineProps = { textMuted };

  return (
    <ScrollView
      testID="dashboard-loading-skeleton"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 16 + activeWorkoutBarPadding,
      }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
      automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
      accessibilityRole="progressbar"
      accessibilityLabel={t('dashboard.loadingSummary', {
        defaultValue: 'Loading summary...',
      })}
      accessibilityState={{ busy: true }}
    >
      <View className="bg-surface rounded-2xl p-4 mb-3 gap-4">
        <View className="flex-row items-center justify-between">
          <SkeletonLine {...skeletonLineProps} width="38%" className="h-4" />
          <SkeletonLine {...skeletonLineProps} width={20} className="h-4" />
        </View>
        <View className="gap-3">
          <SkeletonLine {...skeletonLineProps} width="72%" className="h-5" />
          <SkeletonLine {...skeletonLineProps} width="50%" className="h-4" />
          <SkeletonLine {...skeletonLineProps} width="66%" className="h-5" />
          <SkeletonLine {...skeletonLineProps} width="42%" className="h-4" />
          <SkeletonLine {...skeletonLineProps} width="58%" className="h-5" />
        </View>
      </View>

      <View className="flex-row gap-3 mb-3">
        {[0, 1].map((index) => (
          <View key={index} className="flex-1 bg-surface rounded-2xl p-4 gap-3">
            <SkeletonLine {...skeletonLineProps} width="64%" />
            <SkeletonLine {...skeletonLineProps} width="82%" className="h-8" />
            <SkeletonLine {...skeletonLineProps} width="42%" />
          </View>
        ))}
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-3 gap-4">
        <SkeletonLine {...skeletonLineProps} width="38%" className="h-4" />
        {[0, 1, 2].map((index) => (
          <View key={index} className="gap-2">
            <SkeletonLine {...skeletonLineProps} width="30%" />
            <SkeletonLine {...skeletonLineProps} width="58%" className="h-5" />
            <SkeletonLine {...skeletonLineProps} width="100%" className="h-2" />
          </View>
        ))}
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-3 gap-3">
        <SkeletonLine {...skeletonLineProps} width="32%" className="h-4" />
        <SkeletonLine {...skeletonLineProps} width="84%" />
        <SkeletonLine {...skeletonLineProps} width="62%" />
      </View>
    </ScrollView>
  );
}
