import { onlineRequest } from './account';
import type { GroceryItem, GroceryList } from '../personalSetup';

/** A store chain in a shopping region, as the backend lists it. */
export type Vendor = { code: string; name: string };

/**
 * What a cart costs at one chain. `prices` follows the cart's items in
 * order; `matched` is how many of them the chain has its own price for,
 * the rest keep the plan's price.
 */
export type VendorQuote = Vendor & {
  total: number;
  matched: number;
  prices: (number | null)[];
};

export const vendorsQueryKey = (region: string) =>
  ['prices', 'vendors', region] as const;

/**
 * The chains of a region, from cijene.dev through the backend; never a fixed
 * list. Empty for a region without published shelf prices. Public, so the
 * questionnaire can offer them before sign-in.
 */
export async function fetchVendors(region: string): Promise<Vendor[]> {
  const result = await onlineRequest<{ vendors: Vendor[] }>(
    `/prices/vendors?region=${encodeURIComponent(region)}`,
    undefined,
    false
  );
  return result.vendors;
}

/** The price an item is compared from: the plan's, before any store. */
const basePrice = (item: GroceryItem) => item.basePrice ?? item.price ?? null;

export const comparisonQueryKey = (list: GroceryList) =>
  [
    'prices',
    'compare',
    list.region ?? '',
    list.items.map((item) => [item.staple ?? '', basePrice(item)]),
  ] as const;

/** Every chain's total for the list, cheapest well-covered chain first. */
export async function compareList(
  list: GroceryList
): Promise<{ vendors: VendorQuote[]; price_date: string | null }> {
  return onlineRequest(
    '/prices/compare',
    {
      region: list.region,
      items: list.items.map((item) => ({
        staple: item.staple ?? null,
        price: basePrice(item),
      })),
    },
    false
  );
}

/** The list as bought at `quote`'s chain, or back at plan prices when null. */
export function applyVendor(
  list: GroceryList,
  quote: VendorQuote | null
): GroceryList {
  return {
    ...list,
    vendor: quote?.code,
    store: quote ? quote.name : list.vendor ? '' : list.store,
    items: list.items.map((item, index) => {
      const base = basePrice(item);
      const price = quote ? (quote.prices[index] ?? base) : base;
      return {
        ...item,
        ...(base === null ? null : { basePrice: base }),
        ...(price === null ? null : { price }),
      };
    }),
  };
}

/** The list's total at the prices it holds, or null when nothing is priced. */
export function listTotal(list: GroceryList): number | null {
  const priced = list.items.filter((item) => typeof item.price === 'number');
  if (!priced.length) return null;
  return (
    Math.round(priced.reduce((sum, item) => sum + (item.price ?? 0), 0) * 100) /
    100
  );
}
