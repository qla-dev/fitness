import { plainReplyText } from '../../src/services/online/markai';

it('drops markdown markers but keeps the arithmetic', () => {
  expect(
    plainReplyText(
      [
        '### Your plan',
        '1. **Basal Metabolic Rate (BMR)**: We use `Mifflin-St Jeor`.',
        '   BMR = (10 * 100 kg) + (6.25 * 195 cm)',
        '* Protein: __150 g__',
        '- Fat: 80 g',
      ].join('\n')
    )
  ).toBe(
    [
      'Your plan',
      '1. Basal Metabolic Rate (BMR): We use Mifflin-St Jeor.',
      '   BMR = (10 * 100 kg) + (6.25 * 195 cm)',
      '• Protein: 150 g',
      '• Fat: 80 g',
    ].join('\n')
  );
});

it('leaves plain text alone', () => {
  const text = 'TDEE = 2073.75 * 1.45 = 3006.94 calories.';
  expect(plainReplyText(text)).toBe(text);
});
