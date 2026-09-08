import { render, fireEvent } from '@testing-library/react-native';
import MyLibrarySection from '../../src/components/MyLibrarySection';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: 2 }),
}));
jest.mock('../../src/hooks', () => ({
  useMeals: () => ({ meals: [] }),
  useMedications: () => ({ data: [] }),
}));
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => false,
}));

describe('MyLibrarySection', () => {
  beforeEach(() => mockNavigate.mockClear());

  it.each([
    ['My Food', 'FoodsLibrary'],
    ['My Meals', 'MealsLibrary'],
    ['My Logs', 'MyLogs'],
    ['My Programs', 'WorkoutPresetsLibrary'],
    ['Meal plans', 'MealPlans'],
    ['Medications', 'MedicationsList'],
  ])('opens the saved %s list', (label, destination) => {
    const screen = render(<MyLibrarySection enabled />);
    fireEvent.press(screen.getByText(label));
    expect(mockNavigate).toHaveBeenCalledWith(destination);
  });
});
