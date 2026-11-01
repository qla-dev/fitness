import type { TFunction } from 'i18next';

/**
 * Where the user shops, for meal plans and grocery prices. The former
 * Yugoslav countries first, then the larger European markets and the US.
 * Croatia is the one priced from real shelf prices (api.cijene.dev); the rest
 * get estimates in the chosen currency. Keep in sync with REGIONS in the
 * backend's MealPlanController.
 */
export const SHOPPING_REGIONS = [
  { code: 'HR', currency: 'EUR', name: 'Croatia' },
  { code: 'BA', currency: 'BAM', name: 'Bosnia and Herzegovina' },
  { code: 'RS', currency: 'RSD', name: 'Serbia' },
  { code: 'SI', currency: 'EUR', name: 'Slovenia' },
  { code: 'ME', currency: 'EUR', name: 'Montenegro' },
  { code: 'MK', currency: 'MKD', name: 'North Macedonia' },
  { code: 'XK', currency: 'EUR', name: 'Kosovo' },
  { code: 'DE', currency: 'EUR', name: 'Germany' },
  { code: 'AT', currency: 'EUR', name: 'Austria' },
  { code: 'FR', currency: 'EUR', name: 'France' },
  { code: 'IT', currency: 'EUR', name: 'Italy' },
  { code: 'ES', currency: 'EUR', name: 'Spain' },
  { code: 'NL', currency: 'EUR', name: 'Netherlands' },
  { code: 'BE', currency: 'EUR', name: 'Belgium' },
  { code: 'CH', currency: 'CHF', name: 'Switzerland' },
  { code: 'PL', currency: 'PLN', name: 'Poland' },
  { code: 'SE', currency: 'SEK', name: 'Sweden' },
  { code: 'GB', currency: 'GBP', name: 'United Kingdom' },
  { code: 'US', currency: 'USD', name: 'United States' },
] as const;

export type ShoppingRegion = (typeof SHOPPING_REGIONS)[number]['code'];

/** Every currency a region uses, plus the two travellers ask for most. */
export const SHOPPING_CURRENCIES = [
  'EUR',
  'BAM',
  'RSD',
  'MKD',
  'CHF',
  'PLN',
  'SEK',
  'GBP',
  'USD',
] as const;



/**
 * Regions whose meal plans are priced from official or published shelf
 * prices: Croatia (cijene.dev), Serbia (the retailers' price lists on
 * data.gov.rs) and the Netherlands (Checkjebon). Everywhere else MarkAI
 * estimates the prices. Keep in step with the backend's price sources.
 */
export const OFFICIAL_PRICE_REGIONS: readonly string[] = ['HR', 'RS', 'NL'];

/** Regions whose stores can be compared chain by chain: the same three. */
export const LIVE_PRICE_REGIONS = OFFICIAL_PRICE_REGIONS;

export const regionName = (t: TFunction, code: string): string => {
  const region = SHOPPING_REGIONS.find((item) => item.code === code);
  return region ? t(`regions.${code}`, { defaultValue: region.name }) : code;
};

/**
 * The currency a plan is priced in: shelf prices come in the region's own
 * currency whatever was picked; estimates use the pick, or the region's own.
 */
export function planCurrency(region: string, picked?: string): string {
  const home = SHOPPING_REGIONS.find((item) => item.code === region);
  if (OFFICIAL_PRICE_REGIONS.includes(region)) return home?.currency ?? 'EUR';
  return picked || home?.currency || 'EUR';
}
