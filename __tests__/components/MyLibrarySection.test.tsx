import { render, fireEvent } from '@testing-library/react-native';
import MyLibrarySection from '../../src/components/MyLibrarySection';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: 2 }),
}));

describe('MyLibrarySection', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('opens the saved programs list', () => {
    const screen = render(<MyLibrarySection enabled />);
    expect(screen.getByText('2 items')).toBeTruthy();
    fireEvent.press(screen.getByText('My Programs'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutPresetsLibrary');
  });

  // Food, meals, logs and meal plans live behind the food tab.
  it.each(['My Food', 'My Meals', 'My Logs', 'Meal plans', 'Medications'])(
    'leaves %s to its own tab',
    (label) => {
      const screen = render(<MyLibrarySection enabled />);
      expect(screen.queryByText(label)).toBeNull();
    }
  );
});
