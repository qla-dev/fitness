import {
  isSetupComplete,
  type SetupStep,
} from '../../src/services/setupWizardSession';

const steps: SetupStep[] = [
  {
    id: 'focus',
    heading: 'Focus',
    hint: '',
    fields: [{ id: 'focus', label: 'Focus', multiple: true, options: [] }],
  },
  {
    id: 'age',
    heading: 'Age',
    hint: '',
    fields: [{ id: 'age', label: 'Age', numeric: true }],
  },
  {
    id: 'targetWeight',
    heading: 'Target weight',
    hint: '',
    fields: [
      {
        id: 'targetWeight',
        label: 'Target weight',
        numeric: true,
        showWhen: (a) => Array.isArray(a.focus) && a.focus.includes('lose'),
      },
    ],
  },
];

describe('isSetupComplete', () => {
  it('is incomplete while a question that applies is unanswered', () => {
    expect(isSetupComplete(steps, { focus: ['lose'], age: '30' })).toBe(false);
    expect(isSetupComplete(steps, { focus: ['track'], age: ' ' })).toBe(false);
    expect(isSetupComplete(steps, { focus: [], age: '30' })).toBe(false);
  });

  it('ignores questions hidden by earlier answers', () => {
    expect(isSetupComplete(steps, { focus: ['track'], age: '30' })).toBe(true);
    expect(
      isSetupComplete(steps, {
        focus: ['lose'],
        age: '30',
        targetWeight: '70',
      })
    ).toBe(true);
  });
});
