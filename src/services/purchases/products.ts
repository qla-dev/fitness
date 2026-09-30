/**
 * The in-app purchase catalogue, as it is set up in App Store Connect and
 * RevenueCat. Every product is a consumable: coins are spent, and a program
 * price is bought again for each program. Keep in step with
 * backend/config/purchases.php, which decides what a purchase grants.
 *
 * RevenueCat: offering `coins` holds the coin packages and offering
 * `programs` the three program prices, each package named after its
 * product's last segment (`coins100`, `program1399`…).
 */

/** Offering identifiers in RevenueCat. */
export const OFFERINGS = { coins: 'coins', programs: 'programs' } as const;

/** AI coin packages. */
export const COIN_PRODUCTS = [
  {
    productId: 'fitness.qla.dev.coins100',
    packageId: 'coins100',
    coins: 100,
    listPrice: 2.99,
  },
  {
    productId: 'fitness.qla.dev.coins500',
    packageId: 'coins500',
    coins: 500,
    listPrice: 9.99,
  },
] as const;

/** The three prices every paid program is sold at, in USD. */
export const PROGRAM_PRICE_TIERS = {
  program499: { productId: 'fitness.qla.dev.program499', listPrice: 4.99 },
  program1399: { productId: 'fitness.qla.dev.program1399', listPrice: 13.99 },
  program2899: { productId: 'fitness.qla.dev.program2899', listPrice: 28.99 },
} as const;

export type ProgramPriceTier = keyof typeof PROGRAM_PRICE_TIERS;
export type CoinProduct = (typeof COIN_PRODUCTS)[number];

/** List prices are USD until the store answers with the local one. */
export const LIST_PRICE_CURRENCY = 'USD';
