import { useQuery } from '@tanstack/react-query';
import { useOnlineAccount } from '../services/online/account';
import {
  fetchPurchases,
  purchasesAvailable,
  storePrices,
} from '../services/purchases/revenueCat';
import {
  LIST_PRICE_CURRENCY,
  PROGRAM_PRICE_TIERS,
  type ProgramPriceTier,
} from '../services/purchases/products';
import { formatLocalizedNumber } from '../localization';

export const purchasesQueryKey = ['purchases'] as const;

/**
 * The store's local price strings, when this build can sell. Until they
 * arrive, or without purchases, prices show as their USD list price.
 */
export function useStorePrices() {
  const available = purchasesAvailable();
  const { data } = useQuery({
    queryKey: ['purchases', 'storePrices'],
    queryFn: storePrices,
    enabled: available,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  return data ?? {};
}

/** Programs the signed-in account has bought; empty when signed out. */
export function useOwnedPrograms(): Set<string> {
  const signedIn = useOnlineAccount((state) => !!state.session);
  const { data } = useQuery({
    queryKey: purchasesQueryKey,
    queryFn: fetchPurchases,
    enabled: signedIn,
    staleTime: 5 * 60 * 1000,
  });
  return new Set(data?.programs ?? []);
}

/** A price to show: the store's own string, else the USD list price. */
export function priceLabel(
  prices: Record<string, string>,
  productId: string,
  listPrice: number
) {
  return (
    prices[productId] ??
    formatLocalizedNumber(listPrice, {
      style: 'currency',
      currency: LIST_PRICE_CURRENCY,
    })
  );
}

/** A program's price, one of the three. */
export function useProgramPrice(tier: ProgramPriceTier) {
  const prices = useStorePrices();
  const { productId, listPrice } = PROGRAM_PRICE_TIERS[tier];
  return priceLabel(prices, productId, listPrice);
}
