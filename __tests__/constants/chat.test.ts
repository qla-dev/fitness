import {
  getToolDisplay,
  isLookupTool,
  CHAT_SUGGESTIONS,
} from '../../src/constants/chat';

describe('getToolDisplay', () => {
  it('maps the high-traffic logging tools to friendly labels + icons', () => {
    expect(getToolDisplay('markai_manage_food')).toEqual({
      labelKey: 'chat.tools.food',
      defaultLabel: 'Food',
      icon: 'food',
    });
    expect(getToolDisplay('markai_manage_exercise')).toEqual({
      labelKey: 'chat.tools.exercise',
      defaultLabel: 'Exercise',
      icon: 'exercise',
    });
    expect(getToolDisplay('markai_manage_checkin')).toEqual({
      labelKey: 'chat.tools.checkin',
      defaultLabel: 'Check-in',
      icon: 'measurements',
    });
    expect(getToolDisplay('markai_manage_goals')).toEqual({
      labelKey: 'chat.tools.goals',
      defaultLabel: 'Goals',
      icon: 'flame',
    });
  });

  it('labels markai_get_* tools as "Looked up …" with the search icon', () => {
    expect(getToolDisplay('markai_get_food_diary')).toEqual({
      labelKey: 'chat.tools.lookedUp',
      defaultLabel: 'food diary',
      icon: 'search',
    });
  });

  it('humanizes unmapped tool names and falls back to the wrench icon', () => {
    expect(getToolDisplay('markai_search_foods')).toEqual({
      defaultLabel: 'Search foods',
      icon: 'wrench',
    });
    expect(getToolDisplay('some_random_tool')).toEqual({
      defaultLabel: 'Some random tool',
      icon: 'wrench',
    });
  });
});

describe('isLookupTool', () => {
  it('is true for markai_get_* lookup tools', () => {
    expect(isLookupTool('markai_get_food_diary')).toBe(true);
    expect(isLookupTool('markai_get_nutritional_summary')).toBe(true);
  });

  it('is false for manage/other tools', () => {
    expect(isLookupTool('markai_manage_food')).toBe(false);
    expect(isLookupTool('some_random_tool')).toBe(false);
    // Keyed on the `markai_get_` prefix, not the word "search".
    expect(isLookupTool('markai_search_foods')).toBe(false);
  });
});

describe('CHAT_SUGGESTIONS', () => {
  it('provides non-empty starter prompts', () => {
    expect(CHAT_SUGGESTIONS.length).toBeGreaterThan(0);
    CHAT_SUGGESTIONS.forEach((suggestion) => {
      expect(suggestion.prompt.trim().length).toBeGreaterThan(0);
      expect(suggestion.labelKey.trim().length).toBeGreaterThan(0);
    });
  });
});
