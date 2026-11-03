import { dedupeProviders } from '../../src/services/local/providerDedupe';

const provider = (
  id: string,
  provider_type: string,
  provider_name: string,
  created_at: string
) => ({ id, provider_type, provider_name, created_at, is_active: true });

describe('dedupeProviders', () => {
  it('keeps the oldest of each source and repoints the defaults at it', () => {
    const tables = {
      providers: [
        provider(
          'local-off',
          'openfoodfacts',
          'Open Food Facts',
          '2026-10-31T10:00:00Z'
        ),
        provider(
          'remote-off',
          'openfoodfacts',
          'Open Food Facts',
          '2026-10-01T10:00:00Z'
        ),
        provider(
          'local-fedb',
          'free-exercise-db',
          'Free Exercise DB',
          '2026-10-31T10:00:00Z'
        ),
        provider('mine', 'mealie', 'Home Mealie', '2026-10-15T10:00:00Z'),
        provider('work', 'mealie', 'Work Mealie', '2026-10-16T10:00:00Z'),
      ],
      preferences: [
        {
          id: 'preferences',
          default_food_data_provider_id: 'local-off',
          default_barcode_provider_id: 'mine',
        },
      ],
    };

    expect(dedupeProviders(tables)).toBe(true);
    expect(tables.providers.map((p) => p.id)).toEqual([
      'remote-off',
      'local-fedb',
      'mine',
      'work',
    ]);
    expect(tables.preferences[0].default_food_data_provider_id).toBe(
      'remote-off'
    );
    expect(tables.preferences[0].default_barcode_provider_id).toBe('mine');
  });

  it('leaves the tables untouched when every source is unique', () => {
    const preferences = [{ id: 'preferences' }];
    const tables = {
      providers: [
        provider(
          'off',
          'openfoodfacts',
          'Open Food Facts',
          '2026-10-01T10:00:00Z'
        ),
        provider(
          'fedb',
          'free-exercise-db',
          'Free Exercise DB',
          '2026-10-01T10:00:00Z'
        ),
      ],
      preferences,
    };
    expect(dedupeProviders(tables)).toBe(false);
    expect(tables.preferences).toBe(preferences);
  });
});
