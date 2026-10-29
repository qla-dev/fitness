/**
 * The in-app purchase catalogue, as it is set up in App Store Connect and
 * RevenueCat. Coin packages are consumables; programs are sold through
 * three monthly subscription levels. Keep in step with
 * backend/config/purchases.php, which decides what a purchase grants.
 *
 * RevenueCat: offering `coins` holds the coin packages and offering
 * `training` the three levels, each package named after its product's last
 * segment (`coins100`, `training2monthly`…). Entitlement `trainingN` is
 * granted by level N and every level above it.
 */

/** Offering identifiers in RevenueCat. */
export const OFFERINGS = { coins: 'coins', training: 'training' } as const;

/**
 * AI coin packages, sold as MarkAI messages: one coin is one reply. The
 * largest is the best value. coins50 and coins500 are no longer sold; the
 * backend still grants them so an earlier purchase verifies.
 */
export const COIN_PRODUCTS = [
  {
    productId: 'fitness.qla.dev.coins100',
    packageId: 'coins100',
    coins: 100,
    listPrice: 2.99,
  },
  {
    productId: 'fitness.qla.dev.coins200',
    packageId: 'coins200',
    coins: 200,
    listPrice: 4.99,
  },
] as const;

/**
 * The three monthly training levels, in EUR. A level unlocks every program
 * at that level and below, for as long as the subscription runs.
 */
export const PROGRAM_PRICE_TIERS = {
  training1: {
    productId: 'fitness.qla.dev.training1monthly',
    packageId: 'training1monthly',
    level: 1,
    listPrice: 5.99,
  },
  training2: {
    productId: 'fitness.qla.dev.training2monthly',
    packageId: 'training2monthly',
    level: 2,
    listPrice: 9.99,
  },
  training3: {
    productId: 'fitness.qla.dev.training3monthly',
    packageId: 'training3monthly',
    level: 3,
    listPrice: 13.99,
  },
} as const;

export type ProgramPriceTier = keyof typeof PROGRAM_PRICE_TIERS;
export type CoinProduct = (typeof COIN_PRODUCTS)[number];

/** List prices are EUR until the store answers with the local one. */
export const LIST_PRICE_CURRENCY = 'EUR';
