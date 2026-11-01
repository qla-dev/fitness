import { Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import CoverFact from './CoverFact';
import TextFact from './TextFact';
import {
  featureFactCopy,
  type FeatureFactKey,
} from '../constants/featureFacts';

/**
 * Cover art per feature, two each, in order of the copy's covers. They sit
 * with the goal covers in `assets/goal-facts/`, at the same 900 × 600. A
 * feature whose art has not landed yet renders its covers as text cards.
 */
const covers: Partial<
  Record<FeatureFactKey, [ImageSourcePropType, ImageSourcePropType]>
> = {
  cycle: [
    require('../../assets/goal-facts/cycle-tracking.jpg'),
    require('../../assets/goal-facts/cycle-tracking-rhythm.jpg'),
  ],
  medications: [
    require('../../assets/goal-facts/medications-routine.jpg'),
    require('../../assets/goal-facts/medications.jpg'),
  ],
};

/** The goal screen's facts section, for a Tracker feature's own screen. */
export default function FeatureFacts({
  feature,
  className = '',
}: {
  feature: FeatureFactKey;
  /** Spacing is the caller's: some screens already pad their content. */
  className?: string;
}) {
  const { t } = useTranslation();
  const copy = featureFactCopy(t, feature);
  const images = covers[feature];
  return (
    <View className={`pt-6 ${className}`} testID={`feature-facts-${feature}`}>
      <Text
        accessibilityRole="header"
        className="text-xl font-bold text-text-primary mb-4"
      >
        {t('featureFacts.heading', { defaultValue: 'Good to know' })}
      </Text>
      {copy.covers.map((cover, index) => (
        <CoverFact
          key={cover.title}
          title={cover.title}
          body={cover.body}
          image={images?.[index]}
        />
      ))}
      <TextFact title={copy.aboutTitle} body={copy.aboutBody} />
    </View>
  );
}
